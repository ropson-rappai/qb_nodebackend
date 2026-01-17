const express = require("express");
const http = require("http");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

// Render provides PORT automatically
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// MySQL Configuration from Render Environment Variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Helper: Validate env variables
function checkEnv() {
  const required = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error("Missing environment variables:", missing.join(", "));
    console.error("Please add them in Render → Service → Environment");
    process.exit(1);
  }
}
checkEnv();

// ✅ Create pool (better for production)
const pool = mysql.createPool(dbConfig);
