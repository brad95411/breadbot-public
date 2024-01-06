import argparse
import mysql.connector
import json
import os
import sys
import datetime
import subprocess
import random
import string
from txtai.pipeline import Transcription
from pprint import pprint

argument_parser = argparse.ArgumentParser(description="BreadMixer is used to combine media from Discord Voice Calls")
argument_parser.add_argument("callid", help="The call id that needs to be mixed")
argument_parser.add_argument("config", help="The BreadBot config file location")
argument_parser.add_argument("-f", "--filespercycle", help="The number of files to combine per run of ffmpeg", default=50)
argument_parser.add_argument("-v", "--verbose", help="Make the script tell you more about what it's doing", action="store_true")

args = argument_parser.parse_args()

if args.verbose:
    print("Checking config file")

if not os.path.exists(args.config):
    print('The file path {path} does not exist'.format(path=args.config))
    sys.exit(1)

with open(args.config) as config:
    json_config = json.loads(config.read())

config_must_contain = [
    "mysql_username", 
    "mysql_password",
    "mysql_db_name",
    "mysql_host",
    "media_voice_folder"
]

if not all([element in json_config for element in config_must_contain]):
    print('One or more of the following config items are missing')
    for element in config_must_contain:
        print('\t{item}'.format(item=element))
    
    sys.exit(2)

if args.verbose:
    print("Connecting to mysql db {dbname}".format(dbname=json_config["mysql_db_name"]))

mydb = mysql.connector.connect(
    host=json_config["mysql_host"],
    user=json_config["mysql_username"],
    password=json_config["mysql_password"],
    database=json_config["mysql_db_name"]
)

cursor = mydb.cursor()

if args.verbose:
    print("Checking to see if call ID {callid} exists".format(callid=args.callid))

cursor.execute("SELECT call_start_time FROM call_states WHERE call_id = %s", [args.callid])

call_start_time = cursor.fetchall()

if len(call_start_time) == 0:
    print('{call_id} does not exist in the database'.format(call_id=args.callid))

    sys.exit(3)

if args.verbose:
    print("Collecting files from {folder}".format(folder=os.path.join(json_config["media_voice_folder"], args.callid)))

file_dict = {}

for file in os.listdir(os.path.join(json_config["media_voice_folder"], args.callid)):
    file_name_no_ext = file.split('.')[0]
    timestamp = int(file_name_no_ext.split('-')[0])
    user_snowflake = file_name_no_ext.split('-')[1]

    file_stamp_as_datetime = datetime.datetime.fromtimestamp(timestamp / 1000)
    time_diff = file_stamp_as_datetime - call_start_time[0][0]

    file_dict[os.path.join(json_config["media_voice_folder"], args.callid, file)] = dict(
        user=user_snowflake, 
        real_date=file_stamp_as_datetime,
        milliseconds_from_starttime=int((time_diff.seconds * 1000) + (time_diff.microseconds / 1000))
    )

file_dict_items = [(k, v) for k, v in file_dict.items()]
file_dict_items.sort(key=lambda a: a[1]["milliseconds_from_starttime"])

if args.verbose:
    print("Collected files: ")
    [print(element) for element in file_dict_items]

list_of_final_merges = []

for i in range(0, len(file_dict_items), args.filespercycle):
    input_list = []
    filter_list = []

    next_endpoint = i + 50 if i + 50 <= len(file_dict_items) else len(file_dict_items)

    for j in range(i, next_endpoint, 1):
        input_list.append(file_dict_items[j][0])
        filter_list.append("[{inputid}]adelay={delay}|{delay}[a{inputid}]".format(
            inputid = j - i,
            delay = file_dict_items[j][1]["milliseconds_from_starttime"]
        ))

    command_list = ["ffmpeg"]

    for input in input_list:
        command_list.append("-i")
        command_list.append(input)

    command_list.append("-filter_complex")

    filter_string = "\""
    filter_string = filter_string + ';'.join(filter_list)
    filter_string = filter_string + ";"

    for j in range(i, next_endpoint, 1):
        filter_string = filter_string + "[a{inputid}]".format(inputid=j - i)

    filter_string = filter_string + "amix=inputs={input_count}:normalize=0[a]\"".format(input_count = next_endpoint - i)

    command_list.append(filter_string)
    command_list.append("-map")
    command_list.append("\"[a]\"")

    output_file_name = os.path.join(
        json_config["media_voice_folder"],
        args.callid,
        "intermediate-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=10)) + ".mp3"
    )

    list_of_final_merges.append(output_file_name)

    command_list.append(output_file_name)

    ffmpeg_process = subprocess.Popen(' '.join(command_list), stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    print(ffmpeg_process.args)

    stdout, stderr = ffmpeg_process.communicate()

    if (ffmpeg_process.returncode != 0):
        print("The ffmpeg process failed")
        print(stdout)
        print(stderr)
        sys.exit(5)

final_command_list = ["ffmpeg"]

for file in list_of_final_merges:
    final_command_list.append("-i")
    final_command_list.append(file)

final_command_list.append("-filter_complex")

filter_string = "\""

for i in range(len(list_of_final_merges)):
    filter_string = filter_string + "[a{inputid}]".format(inputid=i)

filter_string = filter_string + "amix=inputs={input_count}:normalize=0[a];[a]volume=3[boosted]\"".format(input_count=len(list_of_final_merges))

final_command_list.append(filter_string)
final_command_list.append("-map")
final_command_list.append("\"[boosted]\"")
final_command_list.append(os.path.join(json_config["media_voice_folder"], args.callid, "output.mp3"))

final_command_process = subprocess.Popen(' '.join(final_command_list), stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
stdout, stderr = final_command_process.communicate()

if (final_command_process.returncode != 0):
    print("The final ffmpeg process failed")
    print(stdout)
    print(stderr)
    sys.exit(6)

for file in os.listdir(os.path.join(json_config["media_voice_folder"], args.callid)):
    if file.startswith("intermediate"):
        os.remove(os.path.join(json_config["media_voice_folder"], args.callid, file))

transcribe = Transcription("openai/whisper-base")

for (k, v) in file_dict.items():
    text = transcribe(k)

    cursor.execute("INSERT INTO call_transcriptions (call_id, user_snowflake, speaking_start_time, text) VALUES (%s, %s, %s, %s)", [
        args.callid,
        v["user"],
        v["real_date"],
        text
    ])
