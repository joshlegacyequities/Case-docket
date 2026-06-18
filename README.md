# Case Docket — Legacy Equities Management
## Office Network Setup (5 minutes)

---

## What this is
A shared court case filing system. Run it once on **one computer** in the office.
Everyone else opens their browser and goes to that computer's IP address.

---

## Requirements
- **Node.js** — download free at https://nodejs.org (click "LTS" version)
- That's it.

---

## First-time setup

1. **Unzip** this folder somewhere permanent (e.g. your Desktop or Documents)

2. **Open Terminal** (Mac: press Cmd+Space, type "Terminal", hit Enter)

3. **Navigate to the folder:**
   ```
   cd ~/Desktop/docket
   ```
   (adjust path if you put it somewhere else)

4. **Install dependencies** (one time only):
   ```
   npm install
   ```

5. **Start the server:**
   ```
   node server.js
   ```

6. You'll see something like:
   ```
   ╔══════════════════════════════════════════════════╗
   ║  This computer:  http://localhost:3000            ║
   ║  Office network: http://192.168.1.45:3000         ║
   ╚══════════════════════════════════════════════════╝
   ```

7. **Share the network URL** (e.g. `http://192.168.1.45:3000`) with Sabrina, Ari, and Talia.
   They open it in any browser — no install needed on their end.

---

## Every day after that

Just open Terminal and run:
```
cd ~/Desktop/docket
node server.js
```

Or create a simple startup script (ask Josh to set this up).

---

## Your data
- All cases are stored in `cases.db` in this folder (a SQLite database file)
- **Back this file up regularly** — copy it to Google Drive or an external drive
- The file is human-readable with any SQLite viewer if needed

---

## AI summons extraction
Each team member needs to enter their own Anthropic API key in Settings (⚙).
Get a key at: https://console.anthropic.com/settings/keys

---

## Troubleshooting

**"Cannot reach server" error?**
→ The server isn't running. Go back to the computer running it and check the Terminal window.

**Port already in use?**
→ Edit `server.js` line 7, change `3000` to `3001` (or any number)

**Team can't reach it from their computer?**
→ Check that both computers are on the same WiFi/network
→ On Mac: System Settings → Firewall → make sure it's not blocking port 3000

---

## Keeping it running overnight (optional)

Install PM2 to keep the server running even if Terminal closes:
```
npm install -g pm2
pm2 start server.js --name docket
pm2 save
pm2 startup
```
Then follow the instruction PM2 prints.
