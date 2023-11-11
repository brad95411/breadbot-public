const mysql = require('mysql')
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
        })
    }
}

async function isServerRegistered(server_snowflake) {
    var resultLength = null

    await connection_pool.query(`SELECT * FROM servers WHERE server_snowflake = ?;`, [server_snowflake], (error, results, fields) => {
        if (error) {
            console.log(error)
        }

        console.log(results)

        if(results) {
            resultLength = results.length
        } else {
            resultLength = 0
        }
    })

    return resultLength != 0
}

async function registerServer(server_snowflake, server_name, server_description) {
    var sql = `INSERT INTO servers VALUES (?, ?, ?);`
    var result = null

    await connection_pool.query(sql, [server_snowflake, server_name, server_description], (error, results, fields) => {
        if (error) {
            console.log(error)

            result = false
        } else {
            result = true
        }
    })

    return result
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

module.exports = {
    buildPool,
    isServerRegistered,
    registerServer,
    unregisterServer
}