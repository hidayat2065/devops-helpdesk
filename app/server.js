const express = require("express");
const { Pool } = require("pg");

const {
  validateTicketInput,
  validateTicketStatus
} = require("./validation");

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
    version: "1.3.0",
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
      SELECT
        id,
        title,
        priority,
        status,
        created_at
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

app.post("/tickets", async (req, res) => {
  try {
    const validation =
      validateTicketInput(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error
      });
    }

    const {
      title,
      priority
    } = validation.value;

    const result = await pool.query(
      `
        INSERT INTO tickets (
          title,
          priority,
          status
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          title,
          priority,
          status,
          created_at
      `,
      [
        title,
        priority,
        "Open"
      ]
    );

    res.status(201).json({
      message: "Ticket berhasil dibuat",
      ticket: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// =========================================================
// EDIT TITLE + PRIORITY
// PATCH /tickets/:id
// =========================================================
app.patch(
  "/tickets/:id",
  async (req, res) => {
    try {
      const ticketId =
        Number(req.params.id);

      if (
        !Number.isInteger(ticketId) ||
        ticketId <= 0
      ) {
        return res.status(400).json({
          error: "ID ticket tidak valid"
        });
      }

      const validation =
        validateTicketInput(req.body);

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error
        });
      }

      const {
        title,
        priority
      } = validation.value;

      const result = await pool.query(
        `
          UPDATE tickets
          SET
            title = $1,
            priority = $2
          WHERE id = $3
          RETURNING
            id,
            title,
            priority,
            status,
            created_at
        `,
        [
          title,
          priority,
          ticketId
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Ticket tidak ditemukan"
        });
      }

      res.json({
        message:
          "Ticket berhasil diperbarui",
        ticket:
          result.rows[0]
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }
  }
);


// =========================================================
// UPDATE STATUS
// PATCH /tickets/:id/status
// =========================================================
app.patch(
  "/tickets/:id/status",
  async (req, res) => {
    try {
      const ticketId =
        Number(req.params.id);

      if (
        !Number.isInteger(ticketId) ||
        ticketId <= 0
      ) {
        return res.status(400).json({
          error: "ID ticket tidak valid"
        });
      }

      const validation =
        validateTicketStatus(req.body);

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error
        });
      }

      const {
        status
      } = validation.value;

      const result = await pool.query(
        `
          UPDATE tickets
          SET status = $1
          WHERE id = $2
          RETURNING
            id,
            title,
            priority,
            status,
            created_at
        `,
        [
          status,
          ticketId
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Ticket tidak ditemukan"
        });
      }

      res.json({
        message:
          "Status ticket berhasil diperbarui",
        ticket:
          result.rows[0]
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }
  }
);


app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Helpdesk API running on port ${PORT}`
    );
  }
);