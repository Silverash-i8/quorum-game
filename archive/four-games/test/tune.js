const S=require('./sim'),E=require('../src/engine');
function yearly(styles,N){const acc={};for(let i=1;i<=N;i++){const g=S.play(styles,i);for(const p of g.players){const a=acc[p.bot]||(acc[p.bot]=[0,0,0,0,0].map(()=>({close:0,nw:0,units:0,n:0})));p.hist.forEach((h,y)=>{a[y].close+=h.close;a[y].nw+=h.netWorth;a[y].units+=h.units;a[y].n++})}}
for(const k in acc)console.log('   ',k.padEnd(12),'cash by year',acc[k].map(a=>(a.close/a.n).toFixed(1)).join(' '),'| net worth',acc[k].map(a=>(a.nw/a.n).toFixed(1)).join(' '),'| units',acc[k].map(a=>(a.units/a.n).toFixed(1)).join(' '))}
module.exports={yearly};
if(require.main===module){const N=+process.argv[2]||1500;
for(const [t,st] of [['4p',['cost','responsible','tech','balanced']],['3p',['cost','responsible','tech']],['4p 2 cost',['cost','cost','responsible','tech']]]){S.show(S.evaluate(t,st,N));yearly(st,400)}}
