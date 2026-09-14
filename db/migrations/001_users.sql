CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,

    username VARCHAR(50)
        UNIQUE
        NOT NULL,

    password_hash TEXT
        NOT NULL,

    role VARCHAR(20)
        NOT NULL
        DEFAULT 'User'
        CHECK (
            role IN (
                'User',
                'IT Support',
                'Admin'
            )
        ),

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS created_by INTEGER;


DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tickets_created_by_fkey'
    ) THEN

        ALTER TABLE tickets
        ADD CONSTRAINT tickets_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES users(id);

    END IF;

END $$;