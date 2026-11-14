'use strict';
// All card and action text for CELL OUT. Rules numbers live in engine.js.

const MARKET = [
  { id: 'steady', title: 'Steady year', text: 'No surprises. Demand follows the forecast.' },
  { id: 'steady2', title: 'Steady year', text: 'No surprises. Demand follows the forecast.' },
  { id: 'recession', title: 'Recession', text: 'Households cut back. Budget demand falls by 2 units this year.' },
  { id: 'rate', title: 'Interest rate rise', text: 'The Bank of England raises rates. Loan interest is 15% this year instead of 10%.' },
  { id: 'cobalt', title: 'Cobalt price spike', text: 'Mined cobalt jumps in price. Valley and Nordic cells cost £0.5m more this year. Recycled LoopCell is unaffected.' },
  { id: 'passport', title: 'Battery passport law', text: 'Every pack now needs a digital passport. Companies still on Cyber 0 at year end pay £1m to comply by hand.' },
  { id: 'subsidy', title: 'Green subsidy', text: 'A government grant rewards low-carbon packs. Green units sell for £0.5m more this year.' },
  { id: 'boom', title: 'E-bike boom', text: 'Commuters switch to e-bikes. Budget demand rises by 2 units this year.' },
];

const RISK = [
  { id: 'recall', title: 'Product recall', text: 'A batch of packs overheats in the field. Companies with no QA system that bought any Valley cells this year pay £3m and lose 1 Reputation.' },
  { id: 'recall', title: 'Product recall', text: 'A batch of packs overheats in the field. Companies with no QA system that bought any Valley cells this year pay £3m and lose 1 Reputation.' },
  { id: 'recall', title: 'Product recall', text: 'A batch of packs overheats in the field. Companies with no QA system that bought any Valley cells this year pay £3m and lose 1 Reputation.' },
  { id: 'breach', title: 'Data breach', text: 'Hackers get into company servers. Companies on Cyber 0, or below Cyber 2 while holding a trade secret, pay a £2m fine, lose 1 Reputation and lose all their trade secrets.' },
  { id: 'breach', title: 'Data breach', text: 'Hackers get into company servers. Companies on Cyber 0, or below Cyber 2 while holding a trade secret, pay a £2m fine, lose 1 Reputation and lose all their trade secrets.' },
  { id: 'strike', title: 'Nordic strike', text: 'Nordic Cells workers walk out. Companies that bought every cell from Nordic this year lose half their units, rounded up.' },
  { id: 'ban', title: 'Valley export ban', text: 'Valley Cells is hit by an export ban. Companies that bought every cell from Valley this year lose half their units, rounded up.' },
  { id: 'iprace', title: 'IP race', text: 'A rival lab files patents in your field. Each trade secret must be patented now for £1m, or it is lost.' },
  { id: 'whistle', title: 'Whistleblower', text: 'An employee goes to the press. Every Skeleton is rolled again: exposed on a 1, 2 or 3.' },
  { id: 'flood', title: 'Factory flood', text: 'Storm water reaches the factory floor. Each company rolls a die: on a 1 or 2 it loses 1 unit.' },
  { id: 'ransom', title: 'Ransomware', text: 'Production systems are locked. Companies on Cyber 0 pay £2m to recover.' },
  { id: 'award', title: 'Safety award', text: 'The industry body names its safest manufacturer. The QA-certified company with the highest Reputation gains 1 Reputation.' },
];

const DILEMMAS = [
  { id: 'thermal', title: 'Borderline test results',
    story: 'Three packs in 200 overheated in the final thermal test. Launch is on Monday and your biggest order depends on it.',
    proper: 'Delay the launch and retest', shortcut: 'Ship on Monday',
    ref: 'Engineering Council Statement of Ethical Principles: hold paramount the health and safety of others and draw attention to hazards.' },
  { id: 'cobalt', title: 'Cobalt with no paperwork',
    story: 'A broker offers cobalt at half price. There are no provenance papers and nobody will say which mine it came from.',
    proper: 'Refuse and pay the audited price', shortcut: 'Buy it and ask no questions',
    ref: 'Modern Slavery Act 2015, section 54: large businesses must report on slavery and trafficking risks in their supply chains.' },
  { id: 'location', title: 'Riders’ location data',
    story: 'An insurer will pay for the GPS trails your smart packs collect. Your customers agreed to battery diagnostics, not to this.',
    proper: 'Turn the insurer down', shortcut: 'Sell the data',
    ref: 'UK GDPR Article 5(1)(b), purpose limitation: personal data collected for one purpose must not be reused for an incompatible one.' },
  { id: 'greenwash', title: '“Carbon neutral” label',
    story: 'Marketing wants “carbon neutral” on the box this quarter. The offsets that would make it true have not been bought.',
    proper: 'Hold the label until it is true', shortcut: 'Print the label now',
    ref: 'CMA Green Claims Code: environmental claims must be truthful, accurate and backed by evidence.' },
  { id: 'breach72', title: 'A small breach',
    story: 'IT finds that 400 customer records were copied last night. Nobody outside the company knows.',
    proper: 'Report it to the regulator', shortcut: 'Fix it quietly and tell no one',
    ref: 'UK GDPR Article 33: a personal data breach must be reported to the ICO within 72 hours unless it is unlikely to put people at risk.' },
  { id: 'files', title: 'A rival’s design files',
    story: 'A job applicant from your main competitor offers to bring their full cell-balancing design on a USB stick.',
    proper: 'Refuse the files', shortcut: 'Take the USB stick',
    ref: 'Trade Secrets (Enforcement, etc.) Regulations 2018: acquiring or using a trade secret unlawfully is actionable.' },
  { id: 'permit', title: 'The permit fixer',
    story: 'Your factory permit is stuck abroad. A local agent says a cash “facilitation fee” will clear it this week.',
    proper: 'Wait for the proper process', shortcut: 'Pay the fixer',
    ref: 'Bribery Act 2010: paying a bribe is an offence, and so is a company failing to prevent one (section 7).' },
  { id: 'takeback', title: 'Take-back scheme',
    story: 'Collecting and recycling your old packs costs money every year. Nobody has checked whether you actually do it.',
    proper: 'Fund the take-back scheme', shortcut: 'Skip it this year',
    ref: 'Waste Batteries and Accumulators Regulations 2009: producers must take back waste industrial batteries free of charge and send them for approved recycling.' },
  { id: 'latepay', title: 'Paying small suppliers',
    story: 'Cash is tight. Finance suggests paying your small suppliers 120 days late, because they cannot afford to argue.',
    proper: 'Pay suppliers on time', shortcut: 'Make them wait',
    ref: 'Late Payment of Commercial Debts (Interest) Act 1998: suppliers are owed interest on overdue invoices.' },
  { id: 'inspection', title: 'Skipping inspections',
    story: 'The line is two days behind. Dropping the end-of-line inspection would catch the schedule up.',
    proper: 'Keep every inspection', shortcut: 'Skip inspections this batch',
    ref: 'Consumer Protection Act 1987, Part I: producers are liable for damage caused by defective products.' },
  { id: 'software', title: 'Unlicensed software',
    story: 'The battery management code uses a commercial library. Buying licences for every engineer is expensive.',
    proper: 'Buy the licences', shortcut: 'Keep using copied versions',
    ref: 'Copyright, Designs and Patents Act 1988: copying software without a licence infringes copyright.' },
  { id: 'nightshift', title: 'The night shift',
    story: 'A rush order needs the night shift to work 14-hour days for a month. They are too worried about their jobs to refuse.',
    proper: 'Hire temporary staff', shortcut: 'Push the night shift',
    ref: 'Working Time Regulations 1998 and Health and Safety at Work etc. Act 1974: limits on working hours and a duty of care to employees.' },
];

const ACTIONS = [
  { id: 'line', name: 'Build a production line', effect: '+2 units of capacity every year. Costs £1m a year to run.', themes: 'Finance, supply chain' },
  { id: 'rd', name: 'Research and development', effect: 'Gain 1 technology. Technology opens the Premium market.', themes: 'IP, finance' },
  { id: 'qa', name: 'Quality assurance system', effect: 'Permanent. Product recalls no longer hit you.', themes: 'Risk, ethics' },
  { id: 'cyber', name: 'Cyber security', effect: 'Cyber +1. Level 2 protects your data and earns £0.5m more per Premium unit.', themes: 'Data, risk' },
  { id: 'sust', name: 'Sustainability upgrade', effect: 'Sustainability +1. The Green market needs 5.', themes: 'Sustainability, finance' },
  { id: 'recyc', name: 'Recycling partnership', effect: 'Permanent. Sustainability +1, and LoopCell serves you before everyone else.', themes: 'Supply chain, sustainability' },
  { id: 'mkt', name: 'Marketing', effect: 'Reputation +1.', themes: 'Reputation, finance' },
];

const SUPPLIERS = {
  valley: { name: 'Valley Cells', tag: 'Unaudited, high carbon', note: 'Cheapest. Every cell adds 1 to the Climate track.' },
  nordic: { name: 'Nordic Cells', tag: 'Audited, low carbon', note: 'Limited supply. Highest Reputation is served first.' },
  loop: { name: 'LoopCell', tag: 'Recycled', note: 'Very limited. Recycling partners are served first.' },
};

const COMPANY_COLOURS = ['#FF7A66', '#35D0A0', '#6FC3FF', '#FFB627', '#B79BFF', '#FF8FCB'];

module.exports = { MARKET, RISK, DILEMMAS, ACTIONS, SUPPLIERS, COMPANY_COLOURS };
