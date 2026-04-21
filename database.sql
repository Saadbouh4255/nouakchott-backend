-- Database creation
CREATE DATABASE IF NOT EXISTS flutter_web;
USE flutter_web;

-- Table for places
CREATE TABLE IF NOT EXISTS places (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    imageUrl VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: The backend automatically creates this database and table if they do not exist
-- when the server is started.
