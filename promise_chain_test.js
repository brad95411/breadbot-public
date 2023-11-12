const mysql = require('mysql2')
const { mysql_username, mysql_password } = require('./config.json')

var connection_pool = mysql.createPool({
    host: "10.26.48.207",
    user: mysql_username,
    password: mysql_password,
    database: 'breadbot_test',
    connectionLimit: 10
}).promise()

connection_pool.query("SELECT * FROM servers").then(async ([rows, fields]) => {
    console.log(rows)
    return await connection_pool.query("SELECT * FROM channels").then(([rows, fields]) => {
        console.log(rows)
        return "SOME TEXT"
    })
}).catch(() => {return "SOME FAIL TEXT"}).then(console.log)