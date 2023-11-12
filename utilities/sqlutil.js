const mysql = require('mysql2')
const { mysql_username, mysql_password } = require('../config.json')

var connection_pool = null

async function buildPool(db_name) {
    if (connection_pool == null) {
        connection_pool = mysql.createPool({
            host: "10.26.48.207",
            user: mysql_username,
            password: mysql_password,
            database: db_name,
            connectionLimit: 10
        }).promise()
    }
}

async function registerServerIfMissing(server_snowflake, server_name, server_description) {
    return connection_pool.query("SELECT * FROM servers WHERE server_snowflake = ?;", [server_snowflake]).then(async ([rows, fields]) => {
        if (rows) {
            return true
        } else {
            return await connection_pool.query("INSERT INTO servers VALUES (?, ?, ?)", [server_snowflake, server_name, server_description]).then((rows, fields) => {
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
            return await connection_pool.query("INSERT INTO channels VALUES (?, ?, ?)", [channel_snowflake, server_snowflake, channel_name]).then((rows, fields) => {
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
            return await connection_pool.query("INSERT INTO users VALUES (?, ?, ?)", [user_snowflake, user_name, user_displayname]).then((rows, fields) => {
                return true
            })
        }
    }).catch((error) => {
        console.log(error)

        return false
    })
}

async function registerMessage(message_snowflake, channel_snowflake, user_snowflake, message_content, message_timestamp) {
    return connection_pool.query("INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0, 0)", [message_snowflake, channel_snowflake, user_snowflake, message_content, message_timestamp]).then(([rows, fields]) => {
        return true
    }).catch((error) => {
        console.log(error)

        return false
    })
}

module.exports = {
    buildPool,
    unregisterServer,
    registerMessage,
    registerServerIfMissing,
    registerChannelIfMissing,
    registerUserIfMissing
}