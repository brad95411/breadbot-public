const mysql = require('mysql2')
const winston = require('winston')
const winston_mysql = require('winston-mysql')
const { 
    mysql_username, 
    mysql_password, 
    mysql_host, 
    mysql_db_name,
    sqlutil_logging_config 
} = require('../config.json')

var connection_pool = null
var logger = null

async function buildPool() {
    if (connection_pool == null) {
        connection_pool = mysql.createPool({
            host: mysql_host,
            user: mysql_username,
            password: mysql_password,
            database: mysql_db_name,
            connectionLimit: 10,
            multipleStatements: true
        }).promise()
    }

    if (logger == null) {
        logger = winston.createLogger({
            level: "silly",
            transports: [
                new winston.transports.Console({
                    format: winston.format.simple(),
                    level: sqlutil_logging_config["console_log_level"]
                }),
                new winston_mysql({
                    level: sqlutil_logging_config["sql_log_level"],
                    host: sqlutil_logging_config["mysql_host"],
                    user: sqlutil_logging_config["mysql_username"],
                    password: sqlutil_logging_config["mysql_password"],
                    database: sqlutil_logging_config["mysql_db_name"],
                    table: sqlutil_logging_config["mysql_table_name"]
                })
            ]
        })
    }
}

async function registerServerIfMissing(server_snowflake, server_name, server_description) {
    return connection_pool.query("SELECT * FROM servers WHERE server_snowflake = ?;", [server_snowflake]).then(async ([rows, fields]) => {
        if (rows.length != 0) {
            return true
        } else {
            return await connection_pool.query("INSERT INTO servers VALUES (?, ?, ?)", [server_snowflake, server_name, server_description]).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        logger.error(error)

        return false
    })
}

async function registerChannelIfMissing(channel_snowflake, server_snowflake, channel_name) {
    return connection_pool.query("SELECT * FROM channels WHERE channel_snowflake = ?;", [channel_snowflake]).then(async ([rows, fields]) => {
        if (rows.length != 0) {+
            logger.info("Channel already registered")
            return true
        } else {
            logger.info("Channel Not registered, registering")
            return await connection_pool.query("INSERT INTO channels VALUES (?, ?, ?)", [channel_snowflake, server_snowflake, channel_name]).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function updateMessageContentIfPresent(message_snowflake, message_content, message_timestamp) {
    return connection_pool.query("SELECT message_snowflake FROM messages WHERE message_snowflake = ?", [message_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            logger.info("Message specified doesn't exist, probably created before breadbot was here")
            return false
        } else {
            return await connection_pool.query(
                "INSERT INTO message_content_changes (message_snowflake, message_change_old_timestamp, message_change_old_content) " +
                "SELECT message_snowflake, message_timestamp, message_content FROM messages WHERE message_snowflake = ?;" +
                "UPDATE messages SET message_timestamp = ?, message_content = ? WHERE message_snowflake = ?;",
                [message_snowflake, message_timestamp, message_content, message_snowflake]
            ).then(([rows, fields]) => {
                return true
            })
        }    
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function markMessageDeletedIfPresent(message_snowflake) {
    return connection_pool.query("SELECT message_snowflake FROM messages WHERE message_snowflake = ?", [message_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            logger.info("Message specified doesn't exists, probably created before breadbot was here")
            return false
        } else {
            return await connection_pool.query(
                "UPDATE messages SET message_deleted = 1 WHERE message_snowflake = ?", [message_snowflake]
            ).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function registerAttachmentIfMissing(attachment_snowflake, message_snowflake, attachment_name, attachment_description, attachment_timestamp, attachment_mime_type, attachment_url) {
    return connection_pool.query("SELECT attachment_snowflake FROM message_attachments WHERE attachment_snowflake = ?", [attachment_snowflake]).then(async ([rows, fields]) => {
        if (rows.length != 0) {
            logger.info("Attachment alreaedy exists")
            return true
        } else {
            return await connection_pool.query(
                "INSERT INTO message_attachments (attachment_snowflake, message_snowflake, attachment_name, attachment_description, attachment_timestamp, attachment_mime_type, attachment_url) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [attachment_snowflake, message_snowflake, attachment_name, attachment_description, attachment_timestamp, attachment_mime_type, attachment_url]
            ).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function registerUserIfMissing(user_snowflake, user_name, user_displayname) {
    return connection_pool.query("SELECT * FROM users WHERE user_snowflake = ?;", [user_snowflake]).then(async ([rows, fields]) => {
        if (rows.length != 0) {
            return true
        } else {
            return await connection_pool.query("INSERT INTO users VALUES (?, ?, ?)", [user_snowflake, user_name, user_displayname]).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function registerMessage(message_snowflake, channel_snowflake, user_snowflake, message_content, message_timestamp) {
    return connection_pool.query("INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0)", [message_snowflake, channel_snowflake, user_snowflake, message_content, message_timestamp]).then(([rows, fields]) => {
        return true
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function inCall(server_snowflake, channel_snowflake) {
    return connection_pool.query("SELECT call_id FROM call_states WHERE server_snowflake = ? AND channel_snowflake = ? AND call_end_time IS NULL", [server_snowflake, channel_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            return -1;
        } else {
            return rows[0].call_id
        }
    }).catch((error) => {
        logger.error(error)
        return -1;
    })
}

async function registerNewCall(server_snowflake, channel_snowflake, call_start_time) {
    return connection_pool.query("INSERT INTO call_states (server_snowflake, channel_snowflake, call_start_time, call_end_time, call_consolidated, call_transcribed, call_data_cleaned_up) VALUES (?, ?, ?, NULL, 0, 0, 0)", [server_snowflake, channel_snowflake, call_start_time]).then(async ([rows, fields]) => {
        if (typeof rows.insertId === 'undefined') {
            return -1;
        } else {
            return rows.insertId
        }
    }).catch((error) => {
        logger.error(error)
        return -1;
    })
}

async function registerUserInCall(call_id, user_snowflake) {
    return connection_pool.query("INSERT INTO call_users (call_id, user_snowflake) VALUES (?, ?)", [call_id, user_snowflake]).then(([rows, fields]) => {
        return true
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function deregisterUserInCall(call_id, user_snowflake) {
    return connection_pool.query("DELETE FROM call_users WHERE call_id = ? AND user_snowflake = ?", [call_id, user_snowflake]).then(([rows, field]) => {
        return true
    }).catch((error) => {
        logger.error(error)
        return false
    })
}

async function getNumberUsersInCall(call_id) {
    return connection_pool.query("SELECT COUNT(call_users_id) AS users_in_call FROM call_users WHERE call_id = ?", [call_id]).then(([rows, fields]) => {
        return rows[0].users_in_call
    }).catch((error) => {
        logger.error(error)
        return -1
    })
}

async function updateCallEndTime(call_id, call_end_time) {
    return await connection_pool.query("UPDATE call_states SET call_end_time = ? WHERE call_id = ?", [call_end_time, call_id]).then(async ([rows, fields]) => {
        return true
    }).catch((error) => {
        logger.error(error)
        return false;
    })
}

module.exports = {
    buildPool,
    registerMessage,
    registerServerIfMissing,
    registerChannelIfMissing,
    registerUserIfMissing,
    registerNewCall,
    updateCallEndTime,
    inCall,
    updateMessageContentIfPresent,
    markMessageDeletedIfPresent,
    registerAttachmentIfMissing,
    registerUserInCall,
    deregisterUserInCall,
    getNumberUsersInCall
}