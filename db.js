
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root@1234",
    database: process.env.DB_NAME || "wellmind_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    const connection = await pool.getConnection();

    try {
        await connection.ping();
        console.log("MySQL Database Connected Successfully!");
    } finally {
        connection.release();
    }
}

module.exports = { pool, testConnection };
