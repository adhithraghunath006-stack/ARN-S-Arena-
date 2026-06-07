// ==================== CONFIGURATION ====================
// 🔴 LOCAL TESTING ke liye ise ON rakhein:
const BASE_URL = "http://localhost:3000";

// 🚀 DEPLOYMENT (Render) ke time upar wali line ko comment karke ise UNCOMMENT kar dena:
// const BASE_URL = "https://your-app.onrender.com"; 
// =======================================================

function signup() {
    let username = document.getElementById("signUser").value;
    let password = document.getElementById("signPass").value;

    fetch(`${BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.message === "Signup success") {
            window.location.href = "login.html";
        }
    })
    .catch(err => {
        console.error("Signup Error:", err);
        alert("Server se connect nahi ho pa raha!");
    });
}

function login() {
    let username = document.getElementById("loginUser").value;
    let password = document.getElementById("loginPass").value;

    fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);

        if (data.message === "Login success") {
            localStorage.setItem("currentPlayer", data.username);
            window.location.href = "game.html";
        }
    })
    .catch(err => {
        console.error("Login Error:", err);
        alert("Server se connect nahi ho pa raha!");
    });
}

/* ================= LOGOUT FUNCTION ================= */
function logout() {
    // LocalStorage se user ka data delete karein
    localStorage.removeItem("currentPlayer");
    
    // User ko wapas login page par bhej dein
    alert("Logged out successfully!");
    window.location.href = "login.html";
}