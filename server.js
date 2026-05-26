const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve your frontend interface folder automatically
app.use(express.static(path.join(__dirname, 'public')));

// Simulated In-Memory Database State (Persistent while server is live)
const database = {
    players: {
        "david": { username: "david", credits: 5000.00, token: "demo-token-1" }
    },
    admins: {
        "admin1": { username: "admin1", role: "root" }
    }
};

// API: Handle Player and Admin Sign-In Handshakes
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const cleanUser = username.trim().toLowerCase();

    if (database.admins[cleanUser]) {
        return res.json({ success: true, role: 'admin', username: cleanUser });
    } else if (database.players[cleanUser]) {
        return res.json({ success: true, role: 'player', player: database.players[cleanUser] });
    } else {
        return res.status(401).json({ success: false, message: "Account profile not found." });
    }
});

// API: Administrative Console Endpoint to Create Brand New Players
app.post('/api/admin/create-player', (req, res) => {
    const { username, initialCredits } = req.body;
    const cleanUser = username.trim().toLowerCase();

    if (database.players[cleanUser]) {
        return res.status(400).json({ error: "Username already exists inside network database." });
    }

    database.players[cleanUser] = {
        username: cleanUser,
        credits: parseFloat(initialCredits) || 0.00,
        token: uuidv4()
    };

    console.log(`[+] Database Event: Created profile ${cleanUser} with $${initialCredits} credits.`);
    return res.json({ success: true, message: `Successfully registered ${cleanUser}`, players: database.players });
});

// API: Administrative Command Endpoint to Inject or Allocate Credits
app.post('/api/admin/allocate-credits', (req, res) => {
    const { targetPlayer, creditAmount } = req.body;
    const cleanTarget = targetPlayer.trim().toLowerCase();

    if (!database.players[cleanTarget]) {
        return res.status(404).json({ error: "Target profile object not found in database registry." });
    }

    database.players[cleanTarget].credits += parseFloat(creditAmount);
    console.log(`[+] Database Event: Injected $${creditAmount} credits into account '${cleanTarget}'.`);
    
    return res.json({ success: true, newBalance: database.players[cleanTarget].credits });
});

app.get('/{*catchall}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[*] System server initialized operational on port ${PORT}`));
