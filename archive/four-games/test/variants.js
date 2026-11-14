const S=require('./sim'),E=require('../src/engine'),T=require('./tune');
const base=JSON.parse(JSON.stringify(E.R));
function setR(o){for(const k in base)E.R[k]=JSON.parse(JSON.stringify(base[k]));for(const k in o){if(typeof o[k]==='object'&&!Array.isArray(o[k]))Object.assign(E.R[k],o[k]);else E.R[k]=o[k]}}
const N=+process.argv[2]||1200;
const V={
 K:{cell:{loopPartner:1.5}},
 N:{cell:{loopPartner:1.5},skeleton:{cash:4,rep:2,auditOn:3}},
 O:{cell:{loopPartner:1.5},skeleton:{cash:3,rep:2,auditOn:3}},
};
const only=process.argv[3]?process.argv[3].split(','):Object.keys(V);
for(const k of only){setR(V[k]);console.log('#### variant',k,JSON.stringify(V[k]));
 for(const [t,st] of [['4p',['cost','responsible','tech','balanced']],['3p',['cost','responsible','tech']],['4p 2cost',['cost','cost','responsible','tech']],['ethics check A',['responsible','hypocrite','tech','cost']],['ethics check B',['tech','opportunist','responsible','cost']]]){const o=S.evaluate(t,st,N);console.log(`  ${t.padEnd(9)} crisis ${o.crisisPct}% richY2 ${o.costRichestY2Pct}% | `+Object.entries(o.rows).sort((a,b)=>b[1].winPct-a[1].winPct).map(([k,r])=>`${k} ${r.winPct}% (nw ${r.nw}, rep ${r.rep}, sc ${r.score})`).join(' | '));if(t==='4p')T.yearly(st,300)}}
