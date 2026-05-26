const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Secure Cloud Database Pool Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize Permanent Tables on Startup
pool.query(`
    CREATE TABLE IF NOT EXISTS players (
        username TEXT PRIMARY KEY,
        credits NUMERIC(10,2) DEFAULT 0.00,
        token TEXT
    );
`).then(() => console.log("[+] Permanent database tables verified.")).catch(err => console.error("[-] DB init error:", err));

// API: Handle Player and Admin Sign-In Handshakes
app.post('/api/auth/login', async (req, res) => {
    const { username } = req.body;
    const cleanUser = username.trim().toLowerCase();

    if (cleanUser === "admin1") {
        return res.json({ success: true, role: 'admin', username: "admin1" });
    }

    try {
        const result = await pool.query('SELECT * FROM players WHERE username = $1', [cleanUser]);
        if (result.rows.length > 0) {
            // Fix row extraction to return the single object properly
            return res.json({ success: true, role: 'player', player: result.rows[0] });
        } else {
            return res.status(401).json({ success: false, message: "Account profile not found." });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "Database lookup failed." });
    }
});

// API: Administrative Console Endpoint to Create Brand New Players
app.post('/api/admin/create-player', async (req, res) => {
    const { username, initialCredits } = req.body;
    const cleanUser = username.trim().toLowerCase();
    const startCredits = parseFloat(initialCredits) || 0.00;

    try {
        await pool.query(
            'INSERT INTO players (username, credits, token) VALUES ($1, $2, $3)',
            [cleanUser, startCredits, uuidv4()]
        );
        return res.json({ success: true, message: "Profile saved permanently." });
    } catch (err) {
        return res.status(400).json({ error: "Username already exists or database failed." });
    }
});

// API: Administrative Command Endpoint to Inject or Allocate Credits
app.post('/api/admin/allocate-credits', async (req, res) => {
    const { targetPlayer, creditAmount } = req.body;
    const cleanTarget = targetPlayer.trim().toLowerCase();
    const addedAmount = parseFloat(creditAmount) || 0.00;

    try {
        // Updated query logic to strictly extract rows[0] columns
        const result = await pool.query(
            'UPDATE players SET credits = credits + $1 WHERE username = $2 RETURNING credits',
            [addedAmount, cleanTarget]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Target account ID does not exist in the database yet. Create it on the left first!" });
        }
        
        const updatedCredits = parseFloat(result.rows[0].credits);
        return res.json({ success: true, newBalance: updatedCredits });
    } catch (err) {
        console.error("Injection transaction failure:", err);
        return res.status(500).json({ error: "Database transaction failed. Check server logs." });
    }
});

// Express v5 Naming Brackets Parameter Route
app.get('/{*catchall}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[*] System server initialized operational on port ${PORT}`));
