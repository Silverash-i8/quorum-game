# QUORUM

An engineering business game for the ELEC3030 Engineering Business Game assignment.
One laptop shows the **big screen**; up to six players join from their **phones** with a code or QR code. About 40 minutes.

Six directors run one battery company for eight quarters: Finance, Engineering, Sales, Compliance, Supply Chain, and Data and IT.
Each quarter one decision comes to the board. Every director gets a **private report** and a **personal bonus** that depends on the vote.
Table your report or keep it to yourself, talk, then vote in secret. If the company runs out of cash or has three serious incidents,
everyone loses. Otherwise the best score wins: a share of company value, bonuses and integrity, minus penalties for anything hidden.

## Start it

| How | When | What you do |
| --- | --- | --- |
| `start-public.bat` | Phones on any network or mobile data | Double-click. Runs in Docker with a free Cloudflare tunnel and prints a public `https://....trycloudflare.com` address (also saved in `public-address.txt`). Needs Docker Desktop running and internet. The address changes on every start. |
| `start.bat` | Everyone on the same Wi-Fi or hotspot | Double-click. Runs on Node.js at `http://localhost:3000/`. If phones cannot connect, the lobby has a box to pick another address. |
| `stop.bat` | Finished | Stops the Docker copy. For the Node.js copy, close its window. |

By hand: `node src/server.js` (Node 18 or newer, nothing to install), or `docker compose up --build -d`.

Open the address on the laptop, press **Host a game**, and let players scan the QR code. Empty seats are filled by bots when you start.

## How a quarter works

1. **Brief.** The big screen shows the decision and its options. Each phone shows a private report, what each option is said to do,
   which risk areas it touches, your own bonus on each option, and which other directors have a bonus riding on it.
   Each director chooses to table the report or keep it.
2. **Vote.** Tabled reports appear on the big screen. The board talks, then each director votes in secret and places one
   department budget: safety testing, supplier audits, cyber security, compliance training, or held back as cash.
3. **Result.** Most votes wins; the chair settles a tie. The screen shows what changed, who earned a bonus, and any incident.

Risk gauges rise every quarter and when the board takes risks. Incidents are checked every second quarter. After quarters 4 and 8 a
board review pays every director for shared targets. A year-end audit finds every report that was hidden on a risky decision.

Every phone always shows the company's cash, orders, value, incidents and four risk gauges, your score broken down line by line,
the whole board's scores, the decisions so far, and a short guide to the rules.

## What is in the folder

| Path | What it is |
| --- | --- |
| `src/quorum.js` | The rules, the 17 agenda items with their reports and bonuses, and the two practice bots. Numbers are in the `R` object at the top. |
| `src/base.js` | Small engine skeleton: lobby, phases, secret submissions, views. |
| `src/server.js` | Web server: rooms, joining, long-polling, timers, saving games, CSV report. No dependencies. |
| `public/` | Big screen (`host.html`), phone (`play.html`), shared shell `kit.js`, the game's screens `quorum.js`, styles, fonts, QR library. |
| `test/` | Unit tests, server tests, a browser end-to-end test and the balance simulation. |
| `archive/four-games/` | The earlier version with Cell Out, Chain Reaction and Patent Pending. Kept for reference; not served. |

## Checks

    npm test              # 13 tests: rules, 400 bot games, junk input, privacy, server
    node test/sim.js 800  # balance: honest boards, bonus-hunting boards, mixed boards
    python3 test/e2e.py   # a full game through real browsers (needs Playwright for Python)

At the end of a game the host can download a CSV of every director's votes and the company's quarter-by-quarter figures.
That is the source for the test-play statistics the Game Overview needs.

## Credits

Game design and code by the team. Fonts: Big Shoulders Display and Barlow (SIL Open Font Licence).
QR code generator by Kazuhiko Arase (MIT licence). No tracking, no accounts, no external services.
