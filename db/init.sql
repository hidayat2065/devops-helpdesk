CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(20) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tickets (title, priority, status)
VALUES
('Internet Lab Komputer Putus', 'High', 'Open'),
('Printer Ruang Guru Offline', 'Medium', 'Open'),
('CCTV Lantai 3 No Signal', 'High', 'In Progress'),
('PC Tata Usaha BSOD', 'Critical', 'Open');