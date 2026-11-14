'use strict';
// Builds the printable Player Instructions and blank Datasheet from the live rules,
// so the paper always matches the game. Run: node scripts/build-docs.js
const fs = require('fs'), path = require('path');
const E = require('../src/engine'), C = require('../src/content');
const R = E.R, m = E.money, out = path.join(__dirname, '..', 'public');
const dice = (n) => (n <= 1 ? '1' : n === 2 ? '1 or 2' : Array.from({ length: n - 1 }, (_, i) => i + 1).join(', ') + ' or ' + n);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const T3 = R.tables[3], T4 = R.tables[4], years = [0, 1, 2, 3, 4].map((i) => R.firstYear + i);
const row = (cells, tag) => '<tr>' + cells.map((c) => '<' + (tag || 'td') + '>' + c + '</' + (tag || 'td') + '>').join('') + '</tr>';
const table = (head, rows, cls) => '<table class="' + (cls || '') + '"><thead>' + row(head, 'th') + '</thead><tbody>' + rows.map((r) => row(r)).join('') + '</tbody></table>';
const risks = []; for (const c of C.RISK) { const f = risks.find((x) => x.id === c.id); if (f) f.n++; else risks.push({ id: c.id, title: c.title, text: c.text, n: 1 }); }
const PROTECT = { recall: 'Buy a QA system, or buy no Valley cells', breach: 'Raise Cyber to ' + R.cyberData + ' (or to 1 if you hold no trade secrets)', strike: 'Buy from more than one supplier', ban: 'Buy from more than one supplier',
  iprace: 'Patent your technology, or keep ' + m(R.cost.patent) + ' spare per secret', whistle: 'Have no Skeletons', flood: 'None. Keep some cash in reserve', ransom: 'Raise Cyber to 1', award: 'A reward: hold a QA system and a high Reputation' };

const head = (title, extra) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
@font-face { font-family: "Big Shoulders"; src: url("/fonts/big-shoulders-display-latin-800-normal.woff2") format("woff2"); font-weight: 800; }
@font-face { font-family: "Big Shoulders"; src: url("/fonts/big-shoulders-display-latin-900-normal.woff2") format("woff2"); font-weight: 900; }
@font-face { font-family: "Barlow"; src: url("/fonts/barlow-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "Barlow"; src: url("/fonts/barlow-latin-600-normal.woff2") format("woff2"); font-weight: 600; }
@font-face { font-family: "Barlow"; src: url("/fonts/barlow-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Barlow", "Segoe UI", sans-serif; color: #0C1230; background: #E9ECF8; font-size: 9.8pt; line-height: 1.34; }
.page { background: #fff; max-width: 210mm; margin: 12px auto; padding: 14mm 15mm; }
h1 { font-family: "Big Shoulders", Impact, sans-serif; font-weight: 900; font-size: 34pt; line-height: 0.95; margin: 0 0 2mm; text-transform: uppercase; color: #1F3BD1; }
h2 { font-family: "Big Shoulders", Impact, sans-serif; font-weight: 800; font-size: 15pt; line-height: 1; margin: 4.5mm 0 1.6mm; padding-top: 2mm; border-top: 2.5pt solid #1F3BD1; break-after: avoid; }
h2 .n { color: #1F3BD1; margin-right: 2mm; }
p { margin: 0 0 2mm; } ul, ol { margin: 0 0 2mm; padding-left: 5mm; } li { margin-bottom: 0.8mm; }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 3mm; } tr { break-inside: avoid; } table.ref { break-inside: avoid; }
th, td { text-align: left; padding: 1mm 1.8mm; border-bottom: 0.5pt solid #C9D0EA; vertical-align: top; }
th { background: #0C1230; color: #fff; font-weight: 600; font-size: 9.5pt; }
td.c, th.c { text-align: center; } .lede { font-size: 12.5pt; } .small { font-size: 9pt; color: #4A5378; }
.box { background: #F4F6FF; border-left: 3pt solid #FFD43B; padding: 2.5mm 3.5mm; margin: 2mm 0 3mm; break-inside: avoid; }
.formula { font-weight: 700; font-size: 12pt; }
.two { display: flex; gap: 5mm; } .two table { font-size: 8.8pt; }
.bar { position: sticky; top: 0; background: #0C1230; color: #fff; padding: 8px 14px; display: flex; gap: 12px; align-items: center; font-weight: 600; }
.bar button, .bar a { font: inherit; font-weight: 700; background: #FFD43B; color: #0C1230; border: 0; border-radius: 8px; padding: 6px 12px; cursor: pointer; text-decoration: none; }
@page { size: A4; margin: 12mm 13mm; }
@media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; padding: 0; max-width: none; } }
${extra || ''}
</style>
</head>
<body>
<div class="bar"><span style="flex:1">${title}</span><a href="/">Back to the game</a><button onclick="window.print()">Print or save as PDF</button></div>`;

// ---------- instructions
const h2 = (() => { let n = 0; return (t) => '<h2><span class="n">' + (++n) + '</span>' + t + '</h2>'; })();
const instr = head('CELL OUT: player instructions') + `
<div class="page">
<h1>Cell Out</h1>
<p class="lede"><b>Player instructions.</b> A business game for ${3} or ${4} players, about 45 minutes. Each player runs a company that builds battery packs for e-bikes and scooters, from ${years[0]} to ${years[4]}.</p>

${h2('The aim')}
<p>Finish ${years[4]} with the highest <b>Enterprise Score</b>. Money counts, and so do your Reputation, your Sustainability and the technology you own.</p>
<div class="box"><p class="formula">Enterprise Score = net worth + Reputation + Sustainability + ${R.score.patent} per patent + ${R.score.secret} per trade secret</p>
<p style="margin:0">Net worth is your cash, minus your debt, plus ${m(R.lineValue)} for each production line. Cutting corners makes money early. It rarely wins.</p></div>

${h2('What you need')}
<ul><li><b>One laptop</b> running the game, ideally on a projector or TV. This is the <b>big screen</b> that everyone watches.</li>
<li><b>One phone each</b>, on the same Wi-Fi or hotspot as the laptop. No app to install: the game runs in the phone's browser.</li>
<li>One <b>datasheet</b> and a pen each.</li></ul>

${h2('Starting a game')}
<ol><li>The host opens <b>localhost:3000/host</b> on the laptop. The big screen shows a QR code and a four-letter game code.</li>
<li>Each player scans the QR code with their phone camera (or types the address shown), enters a company name and presses <b>Join</b>.</li>
<li>With fewer than 3 people, the host can press <b>Add a practice bot</b> to fill a seat.</li>
<li>The host chooses the time allowed for each decision (${90} seconds is a good start) and presses <b>Start the game</b>.</li></ol>
<p>Every company starts the same: ${m(R.start.cash)} cash, no debt, ${R.start.lines} production line, Reputation ${R.start.rep}, Sustainability ${R.start.sust}, Cyber ${R.start.cyber}. Write these in the Start column of your datasheet.</p>

${h2('Your company')}
${table(['On your phone', 'Range', 'What it does'], [
  ['<b>Cash</b>', '£m', 'Pays for everything. Only you can see it.'],
  ['<b>Debt</b>', '0 to ' + m(R.maxDebt), 'Loans of ' + m(R.loan) + '. Interest is ' + R.ratePct + '% a year, rounded up to the next £0.5m.'],
  ['<b>Production lines</b>', '1 to ' + R.maxLines, 'Each line makes up to ' + R.lineCap + ' units a year and costs ' + m(R.runCost) + ' a year to run.'],
  ['<b>Reputation</b>', '0 to 10', 'The highest Reputation is served first by Nordic Cells and wins ties. Counts in your score. Ending on 0 halves your score.'],
  ['<b>Sustainability</b>', '0 to 10', 'The Green market needs ' + R.greenSust + ' or more. Counts in your score.'],
  ['<b>Cyber</b>', '0 to 3', 'Protects you from data breaches and ransomware. At ' + R.cyberData + ' or more, Premium units earn ' + m(R.price.cyberBonus) + ' extra.'],
  ['<b>Technology</b>', 'patents and trade secrets', 'Any technology opens the Premium market. Patents are public and safe. Trade secrets are hidden and can be lost.'],
  ['<b>Skeletons</b>', 'hidden', 'One for each shortcut you took. Each can be exposed later.'],
])}
<p>The big screen shows everyone's Reputation, Sustainability, Cyber, lines, patents and Valley cells. Cash, debt, trade secrets and Skeletons stay private.</p>

${h2('A year in six steps')}
${table(['Step', 'On the big screen', 'On your phone'], [
  ['<b>1 News</b>', 'One market event, what customers want this year, and what the three cell suppliers offer.', 'Read it. Check which markets you can sell in.'],
  ['<b>2 Dilemma</b>', 'A real-world ethical dilemma.', 'Choose in secret: <b>do it properly</b> and pay ' + m(R.dilemma.proper) + ', or take the <b>shortcut</b>, gain ' + m(R.dilemma.shortcut) + ' and hide a Skeleton. The screen shows how many chose each, never who.'],
  ['<b>3 Boardroom</b>', 'The list of actions, then what each board did.', 'Choose up to <b>2 actions</b>. You may also borrow or repay one ' + m(R.loan) + ' loan.'],
  ['<b>4 Cells</b>', 'Deliveries, and the Climate track moving.', 'Order cells from the three suppliers. One cell order makes one unit.'],
  ['<b>5 Risk</b>', 'Two risk cards, then the press investigation.', 'See whether you were hit.'],
  ['<b>6 Sales</b>', 'Who sold what in each market.', 'Read your year-end accounts and <b>copy them to your datasheet</b>.'],
])}
<p>When everyone has locked in, the game moves on by itself. You can change your choice until the last player locks in. The host presses the yellow button to move past each result.</p>

<div class="box"><b>Three tips for your first game.</b> Keep enough cash after the boardroom to buy cells: a company that makes nothing earns nothing. Do not make more units than customers will buy: the extra sells at a loss. Buy protection (QA, Cyber) before the risk card arrives, not after.</div>

${h2('Boardroom actions')}
${table(['Action', 'Cost', 'Effect'], [
  ['Build a production line', m(R.lineCost), '+' + R.lineCap + ' units of capacity from this year. Maximum ' + R.maxLines + ' lines. Worth ' + m(R.lineValue) + ' at the end.'],
  ['R&D and patent it', m(R.cost.rd + R.cost.patent), 'A new technology, protected. Announced on the big screen. Worth ' + R.score.patent + ' points.'],
  ['R&D, keep it secret', m(R.cost.rd), 'A new technology as a trade secret. The big screen only says you ran R&D. Worth ' + R.score.secret + ' point.'],
  ['Quality assurance (QA) system', m(R.cost.qa), 'Once only. Product recalls no longer hit you.'],
  ['Cyber security', m(R.cost.cyber), 'Cyber +1, up to 3.'],
  ['Sustainability upgrade', m(R.cost.sust), 'Sustainability +1.'],
  ['Recycling partnership', m(R.cost.recyc), 'Once only. Sustainability +1, and LoopCell serves you before everyone else.'],
  ['Marketing', m(R.cost.mkt), 'Reputation +1.'],
])}

${h2('Buying cells')}
${table(['Supplier', 'Price per cell', 'How many', 'Catch'], [
  ['<b>Valley Cells</b><br>unaudited, high carbon', m(R.cell.valley) + ', plus a carbon levy of ' + m(R.levy[1]) + ', ' + m(R.levy[2]) + ' or ' + m(R.levy[3]) + ' once the Climate track reaches ' + R.climateSteps.join(', '), 'No limit', 'Each cell adds 1 to the shared Climate track. If you buy any, roll a die: on a 1 an exposé costs you 1 Reputation. If most of your cells are Valley, Sustainability −1.'],
  ['<b>Nordic Cells</b><br>audited, low carbon', m(R.cell.nordic), 'Limited (see the last page)', 'The company with the highest Reputation is served first.'],
  ['<b>LoopCell</b><br>recycled', m(R.cell.loop), 'Very limited', 'Recycling partners are served first, then by Reputation. If at least half your cells are LoopCell, Sustainability +1.'],
])}
<p>If Nordic or LoopCell run out before your turn, you choose in advance what happens: <b>make fewer units</b>, or <b>buy Valley instead</b>. The game rolls all dice for you and shows the result.</p>

${h2('Selling')}
<p>Markets sell in this order. In each one, customers are shared out one unit at a time, starting with the best-placed company, until the customers or the units run out.</p>
${table(['Market', 'Price per unit', 'Who can sell', 'Who is served first'], [
  ['<b>Premium</b>', m(R.price.premium) + ', or ' + m(R.price.premium + R.price.cyberBonus) + ' at Cyber ' + R.cyberData + '+', 'At least 1 technology', 'Most technologies, then Reputation'],
  ['<b>Green</b>', m(R.price.green), 'Sustainability ' + R.greenSust + '+', 'Highest Sustainability, then Reputation'],
  ['<b>Budget</b>', m(R.price.budget), 'Everyone', 'Lowest average cell cost, then Reputation'],
])}
<p>Units nobody wants are cleared at ${m(R.price.clearance)} each, which is less than they cost to make. Budget customers shrink over the five years while Green customers grow.</p>

${h2('Risk cards and how to protect yourself')}
<p>Two cards are drawn each year from a deck of ${C.RISK.length}.</p>
${table(['Card', 'In deck', 'What happens', 'Protection'], risks.map((r) => ['<b>' + esc(r.title) + '</b>', '<span class="c">' + r.n + '</span>', esc(r.text), PROTECT[r.id]]))}
<p><b>Press investigation.</b> After the risk cards, the game rolls a die for every hidden Skeleton. On a ${dice(R.skeleton.yearOn)} it is exposed: you pay ${m(R.skeleton.cash)} and lose ${R.skeleton.rep} Reputation. A shortcut gains you ${m(R.dilemma.shortcut)}; being caught costs far more.</p>

${h2('Year-end accounts')}
<p>The game does the sums. Your phone shows them in this order:</p>
<ol><li><b>Sales</b>, plus clearance of unsold units and any shortcut income.</li>
<li><b>Costs:</b> cells, ${m(R.runCost)} per line to run, investments (every action except a new line), loan interest, fines and incidents.</li>
<li><b>Profit before tax</b>, then <b>tax</b> of ${m(1)} for every full ${m(R.taxBand)} of profit. A new production line is a capital purchase: it comes out of cash but not out of profit.</li>
<li><b>Cash at end of year.</b> If it is below zero, the bank forces ${m(R.loan)} emergency loans on you until it is not, and you lose 1 Reputation.</li></ol>

${h2('The end of the game')}
<ol><li><b>Final audit.</b> After ${years[4]}, the game rolls a die for every Skeleton still hidden. On a ${dice(R.skeleton.auditOn)} it is exposed: ${m(R.skeleton.cash)} and ${R.skeleton.rep} Reputation.</li>
<li><b>Climate crisis.</b> If the Climate track has reached ${R.climateSteps[2]}, every company loses ${R.crisisPenalty} points, and the company that bought the most Valley cells loses ${R.polluterPenalty} more.</li>
<li><b>Score.</b> The big screen shows every company's Enterprise Score. A company on Reputation 0 has its score halved. If scores are tied, the higher Reputation wins.</li></ol>

${h2('If something goes wrong')}
<ul><li><b>A phone loses the game.</b> Reopen the same address. It returns to your company. If that fails, join again with the game code and exactly the same company name.</li>
<li><b>Someone is slow or has left.</b> The timer closes the round, or the host presses <b>Close this round now</b>. A company that did not answer does the dilemma properly, takes no actions, and orders Nordic cells it can afford.</li>
<li><b>The laptop restarts.</b> Start the game again and reopen the host page in the same browser. Games in progress are saved.</li></ul>

${h2('Why the game works this way')}
<p>Every decision touches more than one part of the business:</p>
<ul><li><b>Supply chain and sustainability.</b> Cheap unaudited cells raise your margin, and also your carbon levy, your recall risk and the Climate track that every company shares.</li>
<li><b>Intellectual property and data.</b> A patent costs more and is public. A trade secret is cheaper and hidden, but a data breach or a rival's filing can take it. Good cyber security protects data and lets you charge more.</li>
<li><b>Finance.</b> Loans fund growth and cost interest. Lines are assets. Running out of cash costs Reputation.</li>
<li><b>Ethics and risk.</b> Shortcuts pay now and become hidden liabilities. Each risk card has a control you could have bought earlier.</li></ul>
<p><b>Reputation links them all.</b> You lose it through ethics, risk and data failures. You use it to be served first by suppliers, and it counts in the final score.</p>

<h2>Reference: customers and cell supply by year</h2>
<div class="two">
${table(['4 players'].concat(years), [['Premium customers'].concat(T4.premium), ['Green customers*'].concat(T4.green), ['Budget customers'].concat(T4.budget), ['Nordic cells'].concat(T4.nordic), ['LoopCell cells'].concat(T4.loop)], 'ref')}
${table(['3 players'].concat(years), [['Premium customers'].concat(T3.premium), ['Green customers*'].concat(T3.green), ['Budget customers'].concat(T3.budget), ['Nordic cells'].concat(T3.nordic), ['LoopCell cells'].concat(T3.loop)], 'ref')}
</div>
<p class="small">* Plus 1 for each Climate step passed (${R.climateSteps.join(', ')}).</p>
<p class="small">Market events (one per year, 5 of ${C.MARKET.length} used): ${[...new Set(C.MARKET.map((c) => c.title))].join(', ')}. The game also runs with 2, 5 or 6 companies by scaling these tables, but it is designed and balanced for 3 or 4. Rules version ${R.version}.</p>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'instructions.html'), instr);

// ---------- datasheet
const blank = (label, start, note) => '<tr><td class="lab">' + label + (note ? ' <span class="small">' + note + '</span>' : '') + '</td><td class="c start">' + (start === undefined ? '' : start) + '</td>' + years.map(() => '<td></td>').join('') + '</tr>';
const group = (t) => '<tr class="grp"><td colspan="' + (2 + years.length) + '">' + t + '</td></tr>';
const sheet = `<section class="sheet">
<div class="top"><div class="title">Cell Out <span>player datasheet</span></div><div class="f">Company <i></i></div><div class="f">Player <i></i></div><div class="f short">Game code <i></i></div></div>
<table><thead><tr><th>At the end of each year, copy these from your phone</th><th class="c">Start</th>${years.map((y) => '<th class="c">' + y + '</th>').join('')}</tr></thead><tbody>
${group('Production and sales (units)')}
${blank('Units made')}${blank('Sold to Premium')}${blank('Sold to Green')}${blank('Sold to Budget')}
${group('Money (£m)')}
${blank('Sales, including clearance and other income')}${blank('Cell costs')}${blank('Running the lines')}${blank('Investments')}${blank('Loan interest')}${blank('Fines and incidents')}${blank('Profit before tax')}${blank('Tax')}
${blank('<b>Cash at end of year</b>', m(R.start.cash))}${blank('Debt', m(R.start.debt))}${blank('Production lines', R.start.lines)}${blank('<b>Net worth</b>', m(R.start.cash + R.lineValue * R.start.lines), '(cash − debt + ' + m(R.lineValue) + ' per line)')}
${group('Standing')}
${blank('Reputation', R.start.rep, '(0 to 10)')}${blank('Sustainability', R.start.sust, '(0 to 10)')}${blank('Cyber', R.start.cyber, '(0 to 3)')}${blank('Patents', 0)}${blank('Trade secrets', 0)}${blank('Valley cells bought, running total', 0)}
</tbody></table>
<div class="bottom"><div class="score"><b>Final Enterprise Score</b><div class="sum"><span><i></i>Net worth</span>+<span><i></i>Reputation</span>+<span><i></i>Sustainability</span>+<span><i></i>${R.score.patent} × patents</span>+<span><i></i>${R.score.secret} × secrets</span>−<span><i></i>Climate penalty</span>=<span class="tot"><i></i>Score</span></div></div>
<div class="notes"><b>Decisions I would change</b><i></i><i></i></div></div>
</section>`;
const ds = head('CELL OUT: player datasheet', `
.sheet { background: #fff; width: 297mm; height: 209mm; overflow: hidden; margin: 12px auto; padding: 8mm 11mm; break-after: page; break-inside: avoid; display: flex; flex-direction: column; }
.sheet:last-child { break-after: auto; }
.top { display: flex; gap: 7mm; align-items: flex-end; margin-bottom: 3mm; }
.title { font-family: "Big Shoulders", Impact, sans-serif; font-weight: 900; font-size: 26pt; line-height: 0.9; text-transform: uppercase; color: #1F3BD1; white-space: nowrap; }
.title span { font-size: 13pt; color: #0C1230; font-weight: 800; }
.f { flex: 1; font-weight: 600; display: flex; gap: 2mm; align-items: flex-end; white-space: nowrap; } .f.short { flex: 0.5; }
.f i { flex: 1; border-bottom: 0.8pt solid #0C1230; height: 6mm; }
.sheet table { margin: 0; font-size: 9.5pt; } .sheet td, .sheet th { border: 0.5pt solid #9AA3C7; padding: 0.6mm 2mm; height: 5.7mm; }
.sheet th { font-size: 9.5pt; } .sheet td:not(.lab) { width: 30mm; } .sheet td.start { background: #F4F6FF; font-weight: 600; width: 22mm; }
.sheet tr.grp td { background: #DDE2F5; font-weight: 700; height: auto; padding: 0.9mm 2mm; font-size: 9pt; }
.bottom { display: flex; gap: 8mm; margin-top: 3.5mm; flex: 1; }
.score { flex: 2.2; } .notes { flex: 1; display: flex; flex-direction: column; } .notes i { display: block; border-bottom: 0.5pt solid #9AA3C7; height: 7mm; }
.sum { display: flex; align-items: flex-end; gap: 2mm; margin-top: 1.5mm; font-weight: 700; font-size: 12pt; }
.sum span { display: flex; flex-direction: column; align-items: center; font-size: 7.6pt; font-weight: 600; flex: 1; text-align: center; white-space: nowrap; }
.sum span i { display: block; width: 100%; height: 9mm; border: 0.8pt solid #0C1230; border-radius: 1.5mm; margin-bottom: 0.8mm; } .sum span.tot i { border-width: 1.8pt; border-color: #1F3BD1; }
@page { size: A4 landscape; margin: 0; }
@media print { .sheet { margin: 0; } }
@media screen and (max-width: 1150px) { .sheet { transform-origin: top left; } body { overflow-x: auto; } }
`) + '<div id="sheets">' + sheet + `</div>
<script>
// ?copies=10 repeats the sheet so one print gives the full set.
(function () { var n = Math.min(40, Math.max(1, parseInt(new URLSearchParams(location.search).get('copies') || '1', 10) || 1)); var box = document.getElementById('sheets'), one = box.innerHTML, all = ''; for (var i = 0; i < n; i++) all += one; box.innerHTML = all;
  var bar = document.querySelector('.bar'); if (n === 1) { var a = document.createElement('a'); a.href = '?copies=10'; a.textContent = 'Show 10 copies'; bar.insertBefore(a, bar.lastElementChild); } })();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'datasheet.html'), ds);
console.log('Built instructions.html and datasheet.html from rules ' + R.version);
