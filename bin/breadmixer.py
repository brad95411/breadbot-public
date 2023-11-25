import argparse
import mysql.connector
import json
import os
import sys
import datetime
from pprint import pprint

argument_parser = argparse.ArgumentParser(description="BreadMixer is used to combine media from Discord Voice Calls")
argument_parser.add_argument("callid", help="The call id that needs to be mixed")
argument_parser.add_argument("config", help="The BreadBot config file location")

args = argument_parser.parse_args()

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

mydb = mysql.connector.connect(
    host=json_config["mysql_host"],
    user=json_config["mysql_username"],
    password=json_config["mysql_password"],
    database=json_config["mysql_db_name"]
)

cursor = mydb.cursor()

cursor.execute("SELECT call_start_time FROM call_states WHERE call_id = %s", [args.callid])

call_start_time = cursor.fetchall()

if len(call_start_time) == 0:
    print('{call_id} does not exist in the database'.format(call_id=args.callid))

    sys.exit(3)

file_dict = {}
user_lut = {}

for file in os.listdir(os.path.join(json_config["media_voice_folder"], args.callid)):
    file_name_no_ext = file.split('.')[0]
    timestamp = int(file_name_no_ext.split('-')[0])
    user_snowflake = file_name_no_ext.split('-')[1]

    if not user_snowflake in user_lut:
        cursor.execute("SELECT user_name FROM users WHERE user_snowflake = %s", [user_snowflake])

        username = cursor.fetchall()

        if len(username) == 0:
            print('The user snowflake {snowflake} is not present in the DB'.format(snowflake=user_snowflake))

            sys.exit(4)

        # In this instance you have to unwrap both the result list and the result tuple, 
        # which creates the obnoxious 0,0 double dereference operation
        user_lut[user_snowflake] = username[0][0]


    file_stamp_as_datetime = datetime.datetime.fromtimestamp(timestamp / 1000)
    time_diff = file_stamp_as_datetime - call_start_time[0][0]

    file_dict[file] = dict(
        user=user_lut[user_snowflake], 
        real_date=file_stamp_as_datetime,
        milliseconds_from_starttime=int((time_diff.seconds * 1000) + (time_diff.microseconds / 1000))
    )

pprint(file_dict)

