# Three more game ideas (software-native)

ELEC3030 Engineering Business Game. Written 14 November 2026.
Live copy (Claude Doc): https://claude.ai/artifact/6ZaDqBu8nZ9Snnak8ErbVb

These are three game concepts designed around things only software can do: private screens, secret
simultaneous choices, live timers and automatic bookkeeping. CELL OUT started life as a board game and
has been ported to the web; these three would not work on a table at all without a referee.

**None of the three is built or play-tested.** They are concepts with starting numbers, sized for the
brief: 3 to 4 players, under an hour, several rounds that build on each other, all four themes, and a
win condition tied to professional behaviour.

| Idea | One line | The software trick |
| --- | --- | --- |
| CHAIN REACTION | Four links of one battery supply chain, each blind to the others' stock | Hidden stock and delayed deliveries, then a chart that reveals everything at the end |
| QUORUM | Four directors of one company, each with a private report and a private bonus | Private information, a talk timer and secret votes |
| PATENT PENDING | Rival start-ups bidding for patents, suppliers and data, then licensing to each other | Sealed bids against a clock and automatic royalty payments |

**Recommendation:** keep CELL OUT as the submission, because it is already built and tested. If the team
wants a second, more software-native game, build QUORUM first.

---

## Idea 1: CHAIN REACTION

Four players are the four links of one e-bike battery supply chain: Mine, Cell maker, Pack assembler and
Retailer. Each phone shows only that player's own stock, orders and cash. The chain wins or loses its
contract together, and then one partner comes out on top.

- **Players and time:** 4 players (with 3, the server plays the Mine). 12 weeks at about 2.5 minutes each, so 30 to 40 minutes.
- **Why it needs software:** nobody may see anyone else's stock, and deliveries arrive two weeks after they are ordered. The server tracks every shipment and bill. At the end the big screen draws all four order histories on one chart, and players see how a small change in customer demand turned into huge swings upstream (the bullwhip effect). That reveal is the learning moment.

**One week**

1. The big screen shows market news. Only the Retailer sees the real customer demand.
2. Each player privately orders from the link above and picks sea freight (2 weeks, cheap) or air freight (1 week, dearer, adds carbon).
3. Each player makes one policy choice: share my real demand data with my supplier, pay my supplier on time or 30 days late, or pay for a supplier audit.
4. The server ships what is in stock, sends the bills, and charges for stock held, orders missed and overdraft interest.
5. Every third week an event hits: a port strike, a labour scandal at the mine, a data leak or a demand spike.

| Theme | How it shows up |
| --- | --- |
| Supply chains and sustainability | Lead times, safety stock and the bullwhip effect. Air freight and scrapped overstock add to a shared carbon budget. |
| IP and data | Sharing demand data stops everyone guessing, but your partner then sees your stock and margin. A data-sharing agreement costs money; a leak event punishes sharing without one. |
| Finance | Stock ties up cash. Overdraft interest. Paying late helps your cash and starves your supplier's. |
| Ethics and risk | Paying small suppliers late, skipping audits, and passing a defective batch down the chain instead of scrapping it at your own cost. |

- **Interdependencies:** your order is the next player's demand. If you pay late, your supplier cannot afford to make what you need next week.
- **How you win:** the chain must deliver at least 85% of customer demand and stay inside its carbon budget, or the contract is lost and nobody wins. If the chain succeeds, the winner is the highest Partner Score: profit, plus trust points for paying on time, auditing and sharing honest data, minus penalties. Squeezing your partners sinks the chain you depend on.
- **Build effort:** medium. A new rules engine about the size of CELL OUT's, on the same server and phone shell.
- **Main risks:** the four roles are not symmetrical, so the Retailer and the Mine have different experiences. A failed chain means no winner, which can feel flat. Ethics is the thinnest of the four themes here.

---

## Idea 2: QUORUM

Four players sit on the board of one battery company: Finance Director, Chief Engineer, Supply Chain
Director, and Compliance and Sustainability Director. Every quarter each phone shows a private report
that nobody else can see. Players talk for 90 seconds, then vote in secret.

- **Players and time:** 4 players (with 3, Supply Chain and Compliance merge into one seat). 8 quarters at about 5 minutes each, so around 40 minutes.
- **Why it needs software:** only the Chief Engineer knows the pack failure rate is 3%. Only the Finance Director knows there are two quarters of cash left. Private reports, hidden bonus targets, secret ballots and consequences that surface several quarters later all need a referee that keeps secrets. A phone does that; a board cannot.

**One quarter**

1. An agenda item appears on the big screen, for example "Our biggest customer wants delivery six weeks early".
2. Each director reads a private report on their phone. They can tell the board the truth, shade it or stay quiet. One button, **Table my report**, puts the real report on the big screen.
3. The board talks against a 90-second clock.
4. Each director votes in secret on the agenda item and splits their department's budget between safety testing, supplier audits, cyber security and the cash reserve.
5. The result is revealed and the company dashboard updates: cash, order book, carbon, and three risk gauges that are only partly visible.
6. Every second quarter the server rolls for incidents against the risk gauges. An incident opens an inquiry that shows who knew what, and whether they tabled it.

| Theme | How it shows up |
| --- | --- |
| Supply chains and sustainability | Agenda items on single sourcing, cheap versus audited suppliers and carbon reporting. The Supply Chain Director's bonus rewards low unit cost. |
| IP and data | Patent or keep secret, an engineer leaving with know-how, an offer to buy customer data, how much to spend on cyber security. |
| Finance | Cash runway, a loan covenant, dividend versus investment. The Finance Director's bonus rewards closing cash. |
| Ethics and risk | The core mechanic. What do you do with something only you know, when telling the board costs you your bonus? |

- **Interdependencies:** one company, one budget. A vote to protect cash raises the safety backlog, which later causes a recall, which costs more cash than was saved.
- **How you win:** if the company runs out of cash or loses its licence, everyone loses. Otherwise each director scores a share of company value, plus their personal bonus, plus integrity points for reports tabled, minus inquiry penalties for anything they knew and kept quiet. The four bonuses pull against each other on purpose. The highest score wins.
- **Build effort:** the lowest of the three. There is no market model to balance. Most of the work is writing 12 to 16 agenda items with their reports and consequences.
- **Main risks:** it must not turn into a quiz, which the brief rules out. Each item needs no single right answer, and consequences must carry through the company's state from quarter to quarter. It also depends on players talking: a quiet table makes a flat game.

---

## Idea 3: PATENT PENDING

Three or four rival start-ups are building e-bike drive systems. Each round the server auctions things no
company can make alone: patents, supplier contracts, customer datasets and carbon allowances. Players bid
in secret on their phones, then get 90 seconds to license patents to each other.

- **Players and time:** 3 or 4 players. 6 rounds at about 6 minutes each, so 35 to 40 minutes.
- **Why it needs software:** sealed bids need everyone to commit at once, with no auctioneer and no peeking. Licence deals are private offers between two phones. Royalties then have to be paid on every unit, every round. On a table that is slow and full of arithmetic mistakes; the server does it instantly.

**One round**

1. The lots appear on the big screen: for example two patents, one supplier contract, one dataset and this year's carbon allowances.
2. Everyone bids in secret against a 30-second clock. The highest bid wins and pays. Loans are available, at interest.
3. A 90-second deal window opens. A patent owner can offer a licence (a fee now plus a royalty per unit) and the other player accepts or refuses. A player can also build without a licence.
4. The server runs production and sales. Products need combinations of technology, each unit needs a carbon allowance, and the supplier contract sets cost and risk.
5. An event hits: an infringement claim, a dataset audit, a supplier collapse or a patent challenge.

| Theme | How it shows up |
| --- | --- |
| IP and data | Patent, license or infringe. Datasets come with or without a proper consent trail, and an audit finds the difference. |
| Finance | Bidding strategy and overpaying, debt, royalties as recurring income, and a company valuation at the end. |
| Supply chains and sustainability | Supplier contracts are lots: cheap and unaudited, or certified. Carbon allowances cap how much you can make. |
| Ethics and risk | Infringe or pay, buy grey data or not, deal honestly or not. Liabilities stay hidden until the end. |

- **Interdependencies:** nobody can win every lot, so every player needs a rival's patent. Your competitor is also your customer. Cash spent winning a patent is cash not available for carbon allowances.
- **How you win:** in the final round a buyer carries out due diligence on every company. Valuation is cash, plus patents, plus royalty income, scaled by Reputation, minus every hidden liability: unlicensed technology, data without consent, an unaudited supplier. The highest valuation wins.
- **Build effort:** the highest of the three. It needs timed bidding, player-to-player offers and an economy that has to be balanced by simulation, as CELL OUT was.
- **Main risks:** it is the hardest to explain, and instruction clarity is peer-marked. Auction games can snowball in favour of whoever wins early, so it needs a catch-up route such as licence income. Sustainability is the thinnest theme.

---

## Comparison and recommendation

QUORUM is the best second game to build: it is the cheapest, it puts professional behaviour at the centre,
and its hidden-information mechanic is the hardest to copy on a table. CELL OUT stays the safest submission
because it already runs.

| Game | Status | Strongest themes | Thinnest theme | Players | Length | Build effort |
| --- | --- | --- | --- | --- | --- | --- |
| CELL OUT (web) | Built and tested with bots and automated browsers; not yet played by people | Finance, supply chain and sustainability | IP and data | 3 or 4 (runs with 2 to 6) | About 45 min | Done |
| CHAIN REACTION | Concept | Supply chain, finance | Ethics | 4 (3 with a bot) | 30 to 40 min | Medium |
| QUORUM | Concept | Ethics and risk, finance | Supply chain | 4 (3 with a merged seat) | About 40 min | Low |
| PATENT PENDING | Concept | IP and data, finance | Sustainability | 3 or 4 | 35 to 40 min | High |

- **Against the marking criteria.** Each of the four themes carries 10% and the links between them carry 20%, so a game that is deep on one theme and thin on another loses marks twice. CELL OUT and QUORUM spread most evenly. CHAIN REACTION shows interdependence most vividly, because every order visibly becomes someone else's problem. PATENT PENDING gives the deepest treatment of IP, which is the theme CELL OUT covers least.
- **Against the peer marks.** Another group plays the game from the Player Instructions alone, and instruction clarity is 10% of the mark. In all three ideas the server enforces the rules, so the instructions only need to explain choices, not procedure. QUORUM is the simplest to explain and PATENT PENDING the hardest.
- **What all three reuse.** The room codes, QR joining, host screen and phone screen pattern, timers, saved games and the end-of-game CSV report already exist in the CELL OUT code. Each idea needs a new rules engine, new screens and its own balance testing.

**Open questions for the team**

- [ ] Do we build a second game at all, with the video and Game Overview due on 4 December 2026?
- [ ] If yes, is the group happy to play a game that depends on talking (QUORUM) at the Showcase on 7 December 2026?
- [ ] Should a strong idea from here be folded into CELL OUT instead, for example sealed-bid patents from PATENT PENDING to deepen its IP theme?
