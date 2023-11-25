import argparse
import mysql.connector
import json
import os
import sys
import datetime

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

cursor.execute("SELECT call_start_time FROM call_states WHERE call_id = %d", [args.callid])

call_start_time = cursor.fetchall()

print(call_start_time)

