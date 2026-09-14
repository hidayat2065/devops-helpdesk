const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const VALID_ROLES = [
  "User",
  "IT Support",
  "Admin"
];

const username =
  (process.env.NEW_USERNAME || "").trim();

const password =
  process.env.NEW_PASSWORD || "";

const role =
  process.env.NEW_ROLE || "User";


if (!username) {
  console.error(
    "ERROR: NEW_USERNAME wajib diisi"
  );

  process.exit(1);
}


if (password.length < 8) {
  console.error(
    "ERROR: Password minimal 8 karakter"
  );

  process.exit(1);
}


if (!VALID_ROLES.includes(role)) {
  console.error(
    "ERROR: Role tidak valid"
  );

  process.exit(1);
}


const pool = new Pool({
  host:
    process.env.DB_HOST || "db",

  port:
    process.env.DB_PORT || 5432,

  user:
    process.env.DB_USER || "helpdesk",

  password:
    process.env.DB_PASSWORD || "helpdesk123",

  database:
    process.env.DB_NAME || "helpdeskdb"
});


async function main() {

  try {

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );


    const result =
      await pool.query(
        `
          INSERT INTO users (
            username,
            password_hash,
            role,
            is_active
          )
          VALUES ($1, $2, $3, TRUE)

          ON CONFLICT (username)
          DO UPDATE SET
            password_hash =
              EXCLUDED.password_hash,

            role =
              EXCLUDED.role,

            is_active =
              TRUE

          RETURNING
            id,
            username,
            role,
            is_active,
            created_at
        `,
        [
          username,
          passwordHash,
          role
        ]
      );


    console.log(
      "USER CREATED / UPDATED"
    );

    console.table(
      result.rows
    );

  }
  catch (error) {

    console.error(
      "ERROR:",
      error.message
    );

    process.exitCode = 1;

  }
  finally {

    await pool.end();

  }

}


main();