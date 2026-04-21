const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Serve static files from uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Multer storage configuration for images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database Connection
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
};

let pool;

// Initialize Database and Tables
function initializeDatabase() {
    const connection = mysql.createConnection(dbConfig);
    connection.connect((err) => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
            return;
        }
        console.log('Connected to MySQL server.');

        connection.query('CREATE DATABASE IF NOT EXISTS flutter_web', (err) => {
            if (err) throw err;
            console.log('Database "flutter_web" ready.');
            
            // Re-create pool with database selected
            pool = mysql.createPool({
                ...dbConfig,
                database: 'flutter_web',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS places (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    imageUrl VARCHAR(255) NOT NULL,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            pool.query(createTableQuery, (err) => {
                if (err) throw err;
                console.log('Table "places" is ready.');
            });
            
            connection.end();
        });
    });
}

initializeDatabase();

// --- API Endpoints ---

// Get all places
app.get('/api/places', (req, res) => {
    pool.query('SELECT * FROM places ORDER BY createdAt DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Get places by category
app.get('/api/places/category/:category', (req, res) => {
    const category = req.params.category;
    pool.query('SELECT * FROM places WHERE category = ? ORDER BY createdAt DESC', [category], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add a new place
app.post('/api/places', upload.single('image'), (req, res) => {
    const { name, description, category } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
    }

    const imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;

    const query = 'INSERT INTO places (name, description, category, imageUrl) VALUES (?, ?, ?, ?)';
    pool.query(query, [name, description, category, imageUrl], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
            message: 'Place added successfully', 
            id: result.insertId,
            imageUrl: imageUrl
        });
    });
});

// Delete a place
app.delete('/api/places/:id', (req, res) => {
    const id = req.params.id;

    // First get the image url to delete the file
    pool.query('SELECT imageUrl FROM places WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) {
            const imageUrl = results[0].imageUrl;
            const filename = imageUrl.split('/').pop();
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Then delete from database
        pool.query('DELETE FROM places WHERE id = ?', [id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Place deleted successfully' });
        });
    });
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
