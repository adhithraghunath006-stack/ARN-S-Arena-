require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt"); // Password hashing ke liye install karein: npm i bcrypt

// 5. Missing Mongo Connection Safety Check
if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in environment variables.");
    process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors());

/* ================= DB CONNECT ================= */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("Mongo Error:", err));

/* ================= PLAYER SCHEMA ================= */
const playerSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    wins: { type: Number, default: 0 },
    games: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    draws: { type: Number, default: 0 } // Default value backup
});

const Player = mongoose.model("Player", playerSchema);

/* ================= USER SCHEMA ================= */
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String
});

const User = mongoose.model("User", userSchema);

/* ================= TEST ROUTE ================= */
app.get("/", (req, res) => {
    res.send("Server is running 🚀");
});

/* ================= GAME ROUTES ================= */

/* SAVE DATA (🔥 WIN, LOSE & DRAW LOGIC FIXED) */
app.post("/save", async (req, res) => {
    try {
        let { name, result } = req.body; // 'win', 'lose', or 'draw'

        if (!name) return res.status(400).json({ error: "Name required" });

        name = name.trim().toLowerCase();
        let player = await Player.findOne({ name });

        if (!player) {
            player = new Player({ name });
        }

        player.games += 1; // Match khela toh total games badhega hi

        // Safety fallback block for old schema migration
        if (player.draws === undefined || player.draws === null) {
            player.draws = 0;
        }

        if (result === "win") {
            player.wins += 1;
            player.points += 10;
        } else if (result === "draw") {
            player.draws += 1;
            player.points += 5; // Draw par equal share points
        } else {
            player.points += 2; // Lose par sirf participation points
        }

        await player.save();
        res.json({ message: "Saved successfully" });
    } catch (err) {
        console.log("Save Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* LEADERBOARD */
app.get("/leaderboard", async (req, res) => {
    try {
        let data = await Player.find().sort({ points: -1 });
        res.json(data);
    } catch (err) {
        console.log("Leaderboard Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* RESET (SECURED) */
app.post("/reset", async (req, res) => {
    try {
        const { secretToken } = req.body;
        const masterToken = process.env.RESET_TOKEN || "supersecrettoken123"; 

        if (!secretToken || secretToken !== masterToken) {
            return res.status(403).json({ error: "Unauthorized access" });
        }

        await Player.deleteMany({});
        res.send("Leaderboard Reset Successfully");
    } catch (err) {
        console.log("Reset Error:", err);
        res.status(500).send("Error resetting leaderboard");
    }
});

/* PROFILE (🔥 ZERO-UNDEFINED CRASH-PROOF LOGIC FIXED) */
app.get("/profile/:name", async (req, res) => {
    try {
        let name = req.params.name.trim().toLowerCase();
        let player = await Player.findOne({ name });

        // Database entry absent template fallback
        if (!player) {
            return res.json({ name: name, wins: 0, games: 0, losses: 0, draws: 0, points: 0 });
        }

        // Defensive checks parsing to fix NaN / Undefined variables mapping
        const totalGames = player.games || 0;
        const totalWins = player.wins || 0;
        const totalDraws = player.draws || 0;

        // Mathematical formula evaluation
        const lossesCount = Math.max(0, totalGames - totalWins - totalDraws);

        res.json({
            name: player.name,
            wins: totalWins,
            games: totalGames,
            draws: totalDraws,
            losses: lossesCount,
            points: player.points || 0
        });
    } catch (err) {
        console.log("Profile Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* ================= AUTH ROUTES ================= */
app.post("/signup", async (req, res) => {
    try {
        let { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Username and password required" });

        username = username.trim().toLowerCase();
        let exists = await User.findOne({ username });
        if (exists) return res.status(400).json({ message: "User already exists" });

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = new User({ username, password: hashedPassword });
        await user.save();

        res.json({ message: "Signup success" });
    } catch (err) {
        console.log("Signup Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/login", async (req, res) => {
    try {
        let { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Username and password required" });

        username = username.trim().toLowerCase();
        let user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        res.json({ message: "Login success", username });
    } catch (err) {
        console.log("Login Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});