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

// Create pool (better for production)
const pool = mysql.createPool(dbConfig);

// Press: set is_pressed = 1 and press_order = next
app.post("/press", async (req, res) => {
  try {
    const { userName } = req.body;

    if (!userName) {
      return res.status(400).json({ error: "userName is required" });
    }

    // block multiple presses from same team in same round
    const [checkRows] = await pool.execute(
      "SELECT is_pressed FROM qb_users WHERE user_name = ?",
      [userName]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (checkRows[0].is_pressed === 1) {
      return res.status(409).json({ error: "Already pressed" });
    }

    // next press order
    const [maxOrderRows] = await pool.execute(
      "SELECT COALESCE(MAX(press_order), 0) AS maxOrder FROM qb_users WHERE is_pressed = 1"
    );

    const nextOrder = maxOrderRows[0].maxOrder + 1;

    await pool.execute(
      `UPDATE qb_users
       SET is_pressed = 1,
           press_order = ?,
           press_time = NOW()
       WHERE user_name = ?`,
      [nextOrder, userName]
    );

    await emitUsersUpdate();
    return res.json({ success: true, pressOrder: nextOrder });
  } catch (err) {
    return res.status(500).json({ error: "Press failed" });
  }
});
