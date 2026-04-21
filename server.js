require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

// Serve static files from uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Use memory storage so nothing is saved locally on the hard drive
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize Tables
function initializeDatabase() {
    pool.connect((err, client, release) => {
        if (err) {
            console.error('Error connecting to PostgreSQL:', err.stack);
            return;
        }
        console.log('Connected to PostgreSQL server.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS places (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(100) NOT NULL,
                "imageUrl" TEXT NOT NULL,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        client.query(createTableQuery, (err) => {
            if (err) {
                console.error('Error creating table:', err.stack);
                release();
                return;
            }
            
            // Ensure imageUrl is TEXT to accommodate Base64 strings
            client.query('ALTER TABLE places ALTER COLUMN "imageUrl" TYPE TEXT;', (err) => {
                release();
                if (err) {
                    console.log('Note: Column type alteration skipped or failed:', err.message);
                }
                console.log('Table "places" is ready.');
            });
        });
    });
}

initializeDatabase();

// --- API Endpoints ---

// Get all places
app.get('/api/places', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM places ORDER BY "createdAt" DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get places by category
app.get('/api/places/category/:category', async (req, res) => {
    try {
        const category = req.params.category;
        const result = await pool.query('SELECT * FROM places WHERE category = $1 ORDER BY "createdAt" DESC', [category]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new place
app.post('/api/places', upload.single('image'), async (req, res) => {
    try {
        const { name, description, category } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        // Convert file buffer to Base64 to store strictly in Supabase
        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        const query = 'INSERT INTO places (name, description, category, "imageUrl") VALUES ($1, $2, $3, $4) RETURNING id';

        const result = await pool.query(query, [name, description, category, imageUrl]);
        res.status(201).json({
            message: 'Place added successfully',
            id: result.rows[0].id,
            imageUrl: imageUrl
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a place
app.delete('/api/places/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Simply delete from database since images are stored as Base64 strings directly in Supabase
        await pool.query('DELETE FROM places WHERE id = $1', [id]);
        res.json({ message: 'Place deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
