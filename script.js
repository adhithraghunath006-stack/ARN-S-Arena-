// ==================== 🚀 CONFIGURATION ====================
const BASE_URL = "http://localhost:3000";
// const BASE_URL = "https://your-app.onrender.com"; 
// ==========================================================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/* ================= 🔐 LOGIN FLOW FIX ================= */
(function () {
    const path = window.location.pathname.toLowerCase();
    const isAuthPage = path.endsWith("/login.html") || path.endsWith("/signup.html") || path === "/login" || path === "/signup";
    if (!isAuthPage && !localStorage.getItem("currentPlayer")) {
        window.location.href = "login.html";
    }
})();

/* ================= AUTH ================= */
function loginUser() {
    const username = document.getElementById("loginUser").value;
    const password = document.getElementById("loginPass").value;
    if (!username || !password) return alert("All fields are required!");

    fetch(BASE_URL + "/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.message === "Login success") {
            localStorage.setItem("currentPlayer", data.username); 
            window.location.href = "game.html"; 
        }
    }).catch(err => alert("Server error!"));
}

function signupUser() {
    const username = document.getElementById("signupUser").value;
    const password = document.getElementById("signupPass").value;
    if (!username || !password) return alert("All fields are required!");

    fetch(BASE_URL + "/signup", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.message === "Signup success") {
            window.location.href = "login.html";
        }
    }).catch(err => alert("Server error!"));
}

function logout(){
    localStorage.removeItem("currentPlayer");
    window.location.href = "login.html";
}

function goToProfile(){ window.location.href = "profile.html"; }
function goToPlay(){ window.location.href = "game.html"; }

/* ================= SOUNDS ================= */
function playClickSound() {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = "square"; osc.frequency.setValueAtTime(500, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); osc.connect(gain);
    gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}
function playWinSound() {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = "triangle"; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime); osc.connect(gain);
    gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.4);
}

/* ================= GAME LOGIC ================= */
let board = ["","","","","","","","",""];
let currentPlayer = "X";
let gameActive = false;
let playerNames = {X:"Player X", O:"Player O"};
let moveCount = 0;

const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function startGame(){
 let x = document.getElementById("playerX").value;
 let o = document.getElementById("playerO").value;

 playerNames.X = x || localStorage.getItem("currentPlayer");
 playerNames.O = o || "Opponent";

 gameActive = true; currentPlayer = "X"; moveCount = 0;
 board = ["","","","","","","","",""];
 clearWinLine(); renderBoard();
 const statusEl = document.getElementById("status");
 if(statusEl) statusEl.innerText = playerNames[currentPlayer] + "'s Turn";
}

// 🔥 Sequential Async Handling to prevent DB payload override clashes
async function handleClick(i){
 if(!gameActive || board[i]!="") return;

 board[i] = currentPlayer;
 playClickSound(); moveCount++; renderBoard();

 let winPattern = checkWin();

 if(winPattern){
  const statusEl = document.getElementById("status");
  if(statusEl) statusEl.innerText = playerNames[currentPlayer] + " Wins!";

  drawWinLine(winPattern); confettiBlast(); playWinSound(); shakeBoard();

  let loserKey = currentPlayer === "X" ? "O" : "X";
  gameActive = false; 

  try {
      // 1. First register Winner completely
      let resWin = await fetch(BASE_URL + "/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerNames[currentPlayer], result: "win" })
      });
      await resWin.json();

      // 2. Then fire the Loser payload sequentially to avoid concurrent schema block
      let resLose = await fetch(BASE_URL + "/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerNames[loserKey], result: "lose" })
      });
      await resLose.json();
      
      loadLeaderboard(); // Sync Leaderboard screen properties
  } catch (err) {
      console.error("Match save error:", err);
  }
  return;
 }

 if(moveCount==9){
  const statusEl = document.getElementById("status");
  if(statusEl) statusEl.innerText="Draw! 🤝";
  gameActive = false;

  try {
      // 1. Process sequential safe execution for Player X first during Draws
      let resX = await fetch(BASE_URL + "/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerNames.X, result: "draw" })
      });
      await resX.json();

      // 2. Process sequential pipeline allocation for Player O second
      let resO = await fetch(BASE_URL + "/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerNames.O, result: "draw" })
      });
      await resO.json();

      loadLeaderboard();
  } catch (err) {
      console.error("Draw stats save error:", err);
  }
  return;
 }

 currentPlayer = currentPlayer==="X" ? "O" : "X";
 const statusEl = document.getElementById("status");
 if(statusEl) statusEl.innerText = playerNames[currentPlayer] + "'s Turn";
}

function checkWin(){
 for(let p of winPatterns){
  let [a,b,c] = p;
  if(board[a] && board[a]==board[b] && board[a]==board[c]){ return p; }
 }
 return null;
}

function renderBoard(){ document.querySelectorAll(".cell").forEach((c,i)=> c.innerText = board[i]); }
function clearWinLine(){ document.querySelectorAll(".win-line").forEach(e=>e.remove()); }

function restartGame(){
 board = ["","","","","","","","",""]; moveCount = 0; gameActive = true; currentPlayer = "X";
 clearWinLine(); renderBoard();
 const statusEl = document.getElementById("status");
 if(statusEl) statusEl.innerText = playerNames[currentPlayer] + "'s Turn";
}

function shakeBoard(){
 let b = document.getElementById("board");
 if(b) { b.classList.add("shake"); setTimeout(()=>b.classList.remove("shake"),400); }
}

/* ================= PERFECT WIN LINE ================= */
function drawWinLine(p){
 const b = document.getElementById("board"); if(!b) return; clearWinLine();
 let line = document.createElement("div"); line.className = "win-line"; let key = p.toString();
 line.style.position = "absolute"; line.style.backgroundColor = "red"; line.style.zIndex = "10"; line.style.borderRadius = "5px";

 if(key=="0,1,2"){ line.style.top = "48px"; line.style.left = "10px"; line.style.width = "300px"; line.style.height = "5px"; }
 else if(key=="3,4,5"){ line.style.top = "158px"; line.style.left = "10px"; line.style.width = "300px"; line.style.height = "5px"; }
 else if(key=="6,7,8"){ line.style.top = "268px"; line.style.left = "10px"; line.style.width = "300px"; line.style.height = "5px"; }
 else if(key=="0,3,6"){ line.style.left = "48px"; line.style.top = "10px"; line.style.height = "300px"; line.style.width = "5px"; }
 else if(key=="1,4,7"){ line.style.left = "158px"; line.style.top = "10px"; line.style.height = "300px"; line.style.width = "5px"; }
 else if(key=="2,5,8"){ line.style.left = "268px"; line.style.top = "10px"; line.style.height = "300px"; line.style.width = "5px"; }
 else if(key=="0,4,8"){ line.style.top = "15px"; line.style.left = "15px"; line.style.width = "410px"; line.style.height = "5px"; line.style.transformOrigin = "top left"; line.style.transform = "rotate(45deg)"; }
 else if(key=="2,4,6"){ line.style.top = "15px"; line.style.left = "305px"; line.style.width = "410px"; line.style.height = "5px"; line.style.transformOrigin = "top left"; line.style.transform = "rotate(135deg)"; }
 b.appendChild(line);
}

/* ================= LEADERBOARD ================= */
function loadLeaderboard() {
 fetch(BASE_URL + "/leaderboard")
 .then(res => res.json())
 .then(data => {
  let list = document.getElementById("leaderboardList"); if(!list) return;
  list.innerHTML = "";
  data.forEach((player, i) => {
   let li = document.createElement("li");
   li.innerText = `#${i+1} ${player.name} - Wins: ${player.wins} | Points: ${player.points}`;
   list.appendChild(li);
  });
 }).catch(err => console.log(err));
}

/* ================= PROFILE MAPPING ================= */
function loadProfile(){
    const username = localStorage.getItem("currentPlayer");
    if(!username) return;

    const nameEl = document.getElementById("p_name");
    if(!nameEl) return; 

    fetch(BASE_URL + "/profile/" + username)
    .then(res => res.json())
    .then(data => {
        document.getElementById("p_name").innerText = data.name;
        document.getElementById("p_wins").innerText = data.wins;
        document.getElementById("p_games").innerText = data.games;
        document.getElementById("p_points").innerText = data.points;
        
        const lossEl = document.getElementById("p_losses");
        if(lossEl) lossEl.innerText = data.losses;

        const drawEl = document.getElementById("p_draws");
        if(drawEl) drawEl.innerText = data.draws;
    })
    .catch(err => console.log(err));
}

function resetLeaderboard() {
    const tokenPrompt = prompt("Enter Admin Secret Token to Reset:");
    if(!tokenPrompt) return;
    fetch(BASE_URL + "/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretToken: tokenPrompt })
    }).then(res => {
        if(res.ok) { alert("Leaderboard Reset ✅"); loadLeaderboard(); }
        else { alert("❌ Invalid Token!"); }
    }).catch(err => console.log(err));
}

/* ================= EFFECTS ================= */
function confettiBlast() {
 for (let i = 0; i < 50; i++) {
  let div = document.createElement("div"); div.style.position = "fixed"; div.style.width = "10px"; div.style.height = "10px";
  div.style.background = `hsl(${Math.random()*360},100%,50%)`; div.style.top = "50%"; div.style.left = "50%"; div.style.borderRadius = "50%"; document.body.appendChild(div);
  let x = (Math.random() - 0.5) * 600; let y = (Math.random() - 0.5) * 600;
  div.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${x}px, ${y}px)`, opacity: 0 }], { duration: 900 });
  setTimeout(() => div.remove(), 900);
 }
}

document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById("board")) { renderBoard(); loadLeaderboard(); }
    if(document.getElementById("p_name")) { loadProfile(); }
});

function toggleTheme() {
    document.body.classList.toggle("light");
    let btn = document.querySelector(".theme-btn");
    if(btn) btn.innerText = document.body.classList.contains("light") ? "🌞" : "🌙";
    localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
}
(function(){
    let savedTheme = localStorage.getItem("theme");
    if(savedTheme === "light") document.body.classList.add("light");
})();