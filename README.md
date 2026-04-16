# IPL Mock Auction Game 🏏

A fun real-time IPL-style cricket player auction that you can play with your friends.  
One person becomes the **Auctioneer** and controls the auction, while others join as team owners and bid on players.

Built using **React + Node.js + Socket.io**.

---

## Features

- Create private auction rooms
- Real-time bidding with live updates
- Auctioneer controls (add players, start auction, sell/mark unsold)
- Quick bid buttons (+0.5, +1, +2, +5 Cr) for participants
- Live chat inside the room
- Full auction log (sold & unsold players)
- Player statistics modal (runs, wickets, average, strike rate, etc.)
- Budget tracking and spend analytics for each team
- Clean dark IPL-themed design

---

## Prerequisites

You need to install **only one software** before starting:

1. **Node.js** (Recommended version: 18 or higher)
   - Download from official website: [https://nodejs.org](https://nodejs.org)
   - Choose the **LTS** version (left button)
   - During installation:
     - **Important**: Check the box **"Add to PATH"**
     - Click "Next" on all screens

After installation, restart your computer once (recommended).

---

## Step-by-Step Setup Instructions

### Step 1: Download the Project

1. Download the project as a ZIP file from GitHub.
2. Extract the ZIP file to any folder on your computer (Example: Desktop → create a folder named `ipl-auction` and extract inside it).

You should now have two main folders:
- `client`
- `server`

---

### Step 2: Setup the Backend (Server)

1. Open the **`server`** folder.
2. Inside the `server` folder, press **Shift + Right Click** → Select **"Open PowerShell window here"** (or "Open in Terminal").
3. Run the following commands **one by one** (press Enter after each):

```bash
npm install
node seed.js
npm run dev
```
you should see this:
```
Server running on http://localhost:4000
```
Do not close this window! The server must keep running.

Open a new PowerShell / Command Prompt window.
-Navigate to the client folder

```bash

npm install
npm run dev

```
You will see a message like:
```
VITE v5.x.x  ready in XXX ms
Local:   http://localhost:5173
```

open the link in the browser.

The app should now open.
