const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "helpdesk",
  password: process.env.DB_PASSWORD || "helpdesk123",
  database: process.env.DB_NAME || "helpdeskdb"
});

app.get("/", (req, res) => {
  res.json({
    application: "DevOps Helpdesk API",
    version: "1.0.0",
    status: "running"
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      application: "helpdesk-api",
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

app.get("/tickets", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, priority, status, created_at
      FROM tickets
      ORDER BY id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Helpdesk API running on port ${PORT}`);
});