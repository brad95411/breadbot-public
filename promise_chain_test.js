const mysql = require('mysql2')
const { mysql_username, mysql_password } = require('./config.json')

var connection_pool = mysql.createPool({
    host: "10.26.48.207",
    user: mysql_username,
    password: mysql_password,
    database: db_name,
    connectionLimit: 10
}).promise()

await connection_pool.query("SELECT * FROM servers").then(([rows, fields]) => {
    connection_pool.query("SELECT * FROM channels").then(([rows, fields]) => {
        return "SOME TEXT"
    })
}).then(console.log)