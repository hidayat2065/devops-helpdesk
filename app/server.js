const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const {
  createToken,
  requireAuth
} = require("./auth");

const {
  validateTicketInput,
  validateTicketStatus
} = require("./validation");


const app = express();
const PORT = process.env.PORT || 3000;


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(express.json());


// =========================================================
// DATABASE
// =========================================================

const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "helpdesk",
  password: process.env.DB_PASSWORD || "helpdesk123",
  database: process.env.DB_NAME || "helpdeskdb"
});


// =========================================================
// HELPER VALIDATION
// =========================================================
//
// Dibuat fleksibel supaya tetap cocok dengan validation.js
// yang sudah kita gunakan sebelumnya.
//

function getValidationError(result) {
  if (result === true || result === undefined || result === null) {
    return null;
  }

  if (result === false) {
    return "Data tidak valid";
  }

  if (typeof result === "string") {
    return result;
  }

  if (typeof result === "object") {
    if (result.error) {
      return result.error;
    }

    if (result.message && (
      result.valid === false ||
      result.isValid === false ||
      result.ok === false
    )) {
      return result.message;
    }

    if (
      result.valid === false ||
      result.isValid === false ||
      result.ok === false
    ) {
      return "Data tidak valid";
    }
  }

  return null;
}


// =========================================================
// AUTH - LOGIN
// POST /auth/login
// =========================================================

app.post("/auth/login", async (req, res) => {
  try {
    const username =
      typeof req.body.username === "string"
        ? req.body.username.trim()
        : "";

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (!username || !password) {
      return res.status(400).json({
        error: "Username dan password wajib diisi"
      });
    }


    const result = await pool.query(
      `
        SELECT
          id,
          username,
          password_hash,
          role,
          is_active
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
      [username]
    );


    if (result.rowCount === 0) {
      return res.status(401).json({
        error: "Username atau password salah"
      });
    }


    const user = result.rows[0];


    if (!user.is_active) {
      return res.status(403).json({
        error: "User tidak aktif"
      });
    }


    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );


    if (!passwordValid) {
      return res.status(401).json({
        error: "Username atau password salah"
      });
    }


    const token = createToken(user);


    return res.json({
      message: "Login berhasil",

      token,

      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      error: "Terjadi kesalahan pada proses login"
    });
  }
});


// =========================================================
// AUTH - CURRENT USER
// GET /auth/me
// =========================================================

app.get(
  "/auth/me",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            id,
            username,
            role,
            is_active,
            created_at
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [req.user.id]
      );


      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "User tidak ditemukan"
        });
      }


      const user = result.rows[0];


      if (!user.is_active) {
        return res.status(403).json({
          error: "User tidak aktif"
        });
      }


      return res.json({
        user
      });

    } catch (error) {
      console.error(
        "AUTH ME ERROR:",
        error
      );

      return res.status(500).json({
        error: "Gagal mengambil informasi user"
      });
    }
  }
);


// =========================================================
// ROOT
// GET /
// =========================================================

app.get("/", (req, res) => {
  res.json({
    name: "DevOps Helpdesk",
    version: "1.4.0"
  });
});


// =========================================================
// HEALTH CHECK
// GET /health
// =========================================================

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.json({
      status: "healthy",
      application: "helpdesk-api",
      database: "connected"
    });

  } catch (error) {
    console.error(
      "HEALTH ERROR:",
      error
    );

    return res.status(503).json({
      status: "unhealthy",
      application: "helpdesk-api",
      database: "disconnected"
    });
  }
});


// =========================================================
// GET ALL TICKETS
// GET /tickets
// =========================================================

app.get("/tickets", async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          priority,
          status,
          created_at,
          created_by
        FROM tickets
        ORDER BY id ASC
      `
    );

    return res.json(result.rows);

  } catch (error) {
    console.error(
      "GET TICKETS ERROR:",
      error
    );

    return res.status(500).json({
      error: "Gagal mengambil ticket"
    });
  }
});


// =========================================================
// CREATE TICKET
// POST /tickets
// =========================================================

app.post("/tickets", async (req, res) => {
  try {
    const title =
      typeof req.body.title === "string"
        ? req.body.title.trim()
        : "";

    const priority =
      typeof req.body.priority === "string"
        ? req.body.priority.trim()
        : "Medium";


    const validationResult =
      validateTicketInput({
        title,
        priority
      });


    const validationError =
      getValidationError(
        validationResult
      );


    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }


    const result = await pool.query(
      `
        INSERT INTO tickets (
          title,
          priority,
          status
        )
        VALUES ($1, $2, 'Open')

        RETURNING
          id,
          title,
          priority,
          status,
          created_at,
          created_by
      `,
      [
        title,
        priority || "Medium"
      ]
    );


    return res.status(201).json(
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "CREATE TICKET ERROR:",
      error
    );

    return res.status(500).json({
      error: "Gagal membuat ticket"
    });
  }
});


// =========================================================
// EDIT TICKET
// PATCH /tickets/:id
// =========================================================

app.patch(
  "/tickets/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error: "ID ticket tidak valid"
        });
      }


      const title =
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : "";

      const priority =
        typeof req.body.priority === "string"
          ? req.body.priority.trim()
          : "";


      const validationResult =
        validateTicketInput({
          title,
          priority
        });


      const validationError =
        getValidationError(
          validationResult
        );


      if (validationError) {
        return res.status(400).json({
          error: validationError
        });
      }


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
            created_at,
            created_by
        `,
        [
          title,
          priority,
          id
        ]
      );


      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Ticket tidak ditemukan"
        });
      }


      return res.json(
        result.rows[0]
      );

    } catch (error) {
      console.error(
        "EDIT TICKET ERROR:",
        error
      );

      return res.status(500).json({
        error: "Gagal mengubah ticket"
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
      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error: "ID ticket tidak valid"
        });
      }


      const status =
        typeof req.body.status === "string"
          ? req.body.status.trim()
          : "";


      const validationResult =
        validateTicketStatus(status);


      const validationError =
        getValidationError(
          validationResult
        );


      if (validationError) {
        return res.status(400).json({
          error: validationError
        });
      }


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
            created_at,
            created_by
        `,
        [
          status,
          id
        ]
      );


      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Ticket tidak ditemukan"
        });
      }


      return res.json(
        result.rows[0]
      );

    } catch (error) {
      console.error(
        "UPDATE STATUS ERROR:",
        error
      );

      return res.status(500).json({
        error: "Gagal mengubah status ticket"
      });
    }
  }
);


// =========================================================
// 404
// =========================================================

app.use((req, res) => {
  return res.status(404).json({
    error: "Endpoint tidak ditemukan"
  });
});


// =========================================================
// START SERVER
// =========================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Helpdesk API berjalan pada port ${PORT}`
    );
  }
);