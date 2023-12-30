const mysql = require('mysql2')
const { mysql_username, mysql_password, mysql_host, mysql_db_name } = require('../config.json')

var connection_pool = null

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
}

async function registerServerIfMissing(server_snowflake, server_name, server_description) {
    return connection_pool.query("SELECT * FROM servers WHERE server_snowflake = ?;", [server_snowflake]).then(async ([rows, fields]) => {
        if (rows) {
            return true
        } else {
            return await connection_pool.query("INSERT INTO servers VALUES (?, ?, ?)", [server_snowflake, server_name, server_description]).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        console.log(error)

        return false
    })
}

async function unregisterServer(server_snowflake) {
    var result = null

    await connection_pool.query(`DELETE FROM servers WHERE server_snowflake = ?;`, [server_snowflake], (error, results, fields) => {
        if (error) {
            console.log(error)

            result = false
        } else {
            result = true
        }
    })

    return result
}

async function registerChannelIfMissing(channel_snowflake, server_snowflake, channel_name) {
    return connection_pool.query("SELECT * FROM channels WHERE channel_snowflake = ?;", [channel_snowflake]).then(async ([rows, fields]) => {
        if (rows.length != 0) {
            console.log("Channel Already Registered")
            return true
        } else {
            console.log("Channel Not Registered, registering")
            return await connection_pool.query("INSERT INTO channels VALUES (?, ?, ?)", [channel_snowflake, server_snowflake, channel_name]).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        console.log(error)

        return false
    })
}

async function updateMessageContentIfPresent(message_snowflake, message_content, message_timestamp) {
    return connection_pool.query("SELECT message_snowflake FROM messages WHERE message_snowflake = ?", [message_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            console.log("Message specified doesn't exist, probably created before breadbot was here")
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
        console.log(error)

        return false
    })
}

async function markMessageDeletedIfPresent(message_snowflake) {
    return connection_pool.query("SELECT message_snowflake FROM messages WHERE message_snowflake = ?", [message_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            console.log("Message specified doesn't exists, probably created before breadbot was here")

            return false
        } else {
            return await connection_pool.query(
                "UPDATE messages SET message_deleted = 1 WHERE message_snowflake = ?", [message_snowflake]
            ).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        console.log(error)

        return false
    })
}

async function registerAttachmentIfMissing(attachment_snowflake, message_snowflake, attachment_name, attachment_description, attachment_timestamp, attachment_mime_type, attachment_url) {
    return connection_pool.query("SELECT attachment_snowflake FROM message_attachments WHERE attachment_snowflake = ?", [attachment_snowflake]).then(async ([rows, fields]) => {
        if (rows.length != 0) {
            console.log("Attachment already exists")

            return true
        } else {
            return await connection_pool.query(
                "INSERT INTO (attachment_snowflake, message_snowflake, attachment_name, attachment_description, attachment_timestamp, attachment_mime_type, attachment_url) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [attachment_snowflake, message_snowflake, attachment_name, attachment_description, attachment_timestamp, attachment_mime_type, attachment_url]
            ).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        console.log(error)

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
        console.log(error)

        return false
    })
}

async function registerMessage(message_snowflake, channel_snowflake, user_snowflake, message_content, message_timestamp) {
    return connection_pool.query("INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0)", [message_snowflake, channel_snowflake, user_snowflake, message_content, message_timestamp]).then(([rows, fields]) => {
        return true
    }).catch((error) => {
        console.log(error)

        return false
    })
}

async function registerVoiceChannelIfMissing(server_snowflake, channel_snowflake) {
    return connection_pool.query("SELECT * FROM voice_channel_active_users WHERE server_snowflake = ? AND channel_snowflake = ?", [server_snowflake, channel_snowflake]).then(async ([rows, fields]) => {
        if(rows.length != 0) {
            return true
        } else {
            return await connection_pool.query("INSERT INTO voice_channel_active_users VALUES (?, ?, 0)", [server_snowflake, channel_snowflake]).then(([rows, fields]) => {
                return true
            })
        }
    }).catch((error) => {
        console.log(error)

        return false
    })
}

//Add is true, subtract is false
async function updateVoiceActiveUsers(server_snowflake, channel_snowflake, add_or_subtract) {
    var voice_channel_ok = await registerVoiceChannelIfMissing(server_snowflake, channel_snowflake)

    if(voice_channel_ok) {
        var sql = ""

        if(add_or_subtract) {
            sql = "UPDATE voice_channel_active_users SET voice_active_users = voice_active_users + 1 WHERE server_snowflake = ? AND channel_snowflake = ?"
        } else {
            sql = "UPDATE voice_channel_active_users SET voice_active_users = voice_active_users - 1 WHERE server_snowflake = ? AND channel_snowflake = ?"
        }

        return await connection_pool.query(sql, [server_snowflake, channel_snowflake]).then(([rows, fields]) => {
            return true
        })
    } else {
        return false
    }
}

async function getVoiceActiveUsers(server_snowflake, channel_snowflake) {
    return connection_pool.query("SELECT voice_active_users FROM voice_channel_active_users WHERE server_snowflake = ? AND channel_snowflake = ?", [server_snowflake, channel_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            return -1;
        } else {
            return rows[0].voice_active_users
        }
    }).catch((error) => {
        console.log(error)

        return -1;
    })
}

async function inCall(server_snowflake, channel_snowflake) {
    return connection_pool.query("SELECT call_id FROM call_states WHERE server_snowflake = ? AND channel_snowflake = ? AND call_end_time IS NULL", [server_snowflake, channel_snowflake]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            return -1;
        } else {
            console.log("Made it here")
            console.log(rows)
            return rows[0].call_id
        }
    }).catch((error) => {
        console.log(error)

        return -1;
    })
}

async function registerNewCall(server_snowflake, channel_snowflake, call_start_time) {
    return connection_pool.query("INSERT INTO call_states (server_snowflake, channel_snowflake, call_start_time, call_end_time, call_consolidated, call_transcribed, call_data_cleaned_up) VALUES (?, ?, ?, NULL, 0, 0, 0)", [server_snowflake, channel_snowflake, call_start_time]).then(async ([rows, fields]) => {
        if (rows.length == 0) {
            return -1;
        } else {
            return rows.insertId
        }
    }).catch((error) => {
        console.log(error)

        return -1;
    })
}

async function updateCallEndTime(call_id, call_end_time) {
    return await connection_pool.query("UPDATE call_states SET call_end_time = ? WHERE call_id = ?", [call_end_time, call_id]).then(async ([rows, fields]) => {
        return true
    }).catch((error) => {
        console.log(error)

        return false;
    })
}

module.exports = {
    buildPool,
    unregisterServer,
    registerMessage,
    registerServerIfMissing,
    registerChannelIfMissing,
    registerUserIfMissing,
    updateVoiceActiveUsers,
    getVoiceActiveUsers,
    registerNewCall,
    updateCallEndTime,
    inCall,
    updateMessageContentIfPresent,
    markMessageDeletedIfPresent,
    registerAttachmentIfMissing
}