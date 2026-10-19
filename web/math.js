/* Gloria Esser Teaching Tool math engine v1.0 — original, deterministic, dependency free.
   No AI-generated runtime answers. All answers use integer rational arithmetic. */
(function(global){'use strict';
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){const t=a%b;a=b;b=t;}return a||1;}
function F(n,d=1){if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||d===0)throw Error('Invalid fraction');let g=gcd(n,d);let sign=d<0?-1:1;return {n:n/g*sign,d:Math.abs(d)/g};}
function add(a,b){return F(a.n*b.d+b.n*a.d,a.d*b.d)}
function subtract(a,b){return F(a.n*b.d-b.n*a.d,a.d*b.d)}
function mul(a,b){return F(a.n*b.n,a.d*b.d)}
function compare(a,b){return Math.sign(a.n*b.d-b.n*a.d)}
function show(a){return a.d===1?String(a.n):a.n+'/'+a.d}
function parse(input){let s=String(input||'').trim().replace(/\s+/g,' ').replace('−','-');
 if(!s)return null;
 if(/^[-+]?\d+\s+\d+\/\d+$/.test(s)){const m=s.match(/^([-+]?\d+)\s+(\d+)\/(\d+)$/);const w=Number(m[1]),n=Number(m[2]),d=Number(m[3]);if(d===0||n>=d)return null;return F((Math.abs(w)*d+n)*(w<0?-1:1),d);}
 if(/^[-+]?\d+\/[-+]?\d+$/.test(s)){const [n,d]=s.split('/').map(Number);return d?F(n,d):null;}
 if(/^[-+]?\d+(\.\d+)?$/.test(s)){if(s.includes('.')){const negative=s.startsWith('-');const [integer,frac]=s.replace(/^[-+]/,'').split('.');if(frac.length>8)return null;const d=10**frac.length;return F((Number(integer)*d+Number(frac))*(negative?-1:1),d);}return F(Number(s),1);}
 return null;
}
function h(seed){let v=2166136261;for(const ch of String(seed)){v^=ch.charCodeAt(0);v=Math.imul(v,16777619);}return v>>>0}
function random(seed){let t=h(seed);return ()=>{t+=0x6d2b79f5;let q=t;q=Math.imul(q^(q>>>15),q|1);q^=q+Math.imul(q^(q>>>7),q|61);return ((q^(q>>>14))>>>0)/4294967296}}
function pick(r,min,max){return min+Math.floor(r()*(max-min+1))}
function rReduced(r,lo,hi){for(let i=0;i<50;i++){let d=pick(r,lo,hi),n=pick(r,1,d-1);if(gcd(n,d)===1)return {n,d};}return {n:1,d:2};}
const SKILLS=[
 {id:'equivalent',name:'Equivalent fractions'},
 {id:'simplify',name:'Simplifying fractions'},
 {id:'compare',name:'Comparing fractions'},
 {id:'add',name:'Adding fractions'},
 {id:'subtract',name:'Subtracting fractions'},
 {id:'of',name:'Fractions of whole numbers'},
 {id:'mixed',name:'Mixed and improper fractions'}
];
function one(skill,difficulty,r){const upper=difficulty==='easy'?7:difficulty==='challenge'?15:11;let a,b,t,answer,explanation,prompt,meta;
 switch(skill){
 case 'equivalent':{a=rReduced(r,2,upper);t=pick(r,2,difficulty==='challenge'?9:6);let D=a.d*t;answer=F(a.n*t,1);prompt=`${show(a)} = ?/${D}`;explanation=`Multiply numerator and denominator of ${show(a)} by ${t}. ${a.n} × ${t} = ${a.n*t}, so the missing numerator is ${a.n*t}.`;meta={a,t};break;}
 case 'simplify':{a=rReduced(r,2,upper);t=pick(r,2,difficulty==='challenge'?11:7);answer=F(a.n,a.d);prompt=`Simplify ${a.n*t}/${a.d*t}.`;explanation=`Divide both numbers by their greatest common factor, ${t}: (${a.n*t} ÷ ${t})/(${a.d*t} ÷ ${t}) = ${show(a)}.`;meta={a,t};break;}
 case 'compare':{a=rReduced(r,2,upper);b=rReduced(r,2,upper);let relation=compare(a,b);answer=relation<0?'<':relation>0?'>':'=';prompt=`Compare: ${show(a)}  ?  ${show(b)}  (enter <, >, or =)`;explanation=`Cross-multiply: ${a.n} × ${b.d} = ${a.n*b.d}; ${b.n} × ${a.d} = ${b.n*a.d}. Therefore ${show(a)} ${answer} ${show(b)}.`;meta={a,b};break;}
 case 'add':{a=rReduced(r,2,upper);b=rReduced(r,2,upper);if(difficulty==='easy')b=F(pick(r,1,a.d-1),a.d);answer=add(a,b);prompt=`${show(a)} + ${show(b)} = ?`;const common=a.d*b.d;explanation=`Use a common denominator: ${a.n*b.d}/${common} + ${b.n*a.d}/${common} = ${a.n*b.d+b.n*a.d}/${common} = ${show(answer)}.`;meta={a,b};break;}
 case 'subtract':{a=rReduced(r,2,upper);b=rReduced(r,2,upper);if(difficulty==='easy')b=F(pick(r,1,a.d-1),a.d);if(compare(a,b)<0)[a,b]=[b,a];answer=subtract(a,b);prompt=`${show(a)} − ${show(b)} = ?`;const common=a.d*b.d;explanation=`Use a common denominator: ${a.n*b.d}/${common} − ${b.n*a.d}/${common} = ${a.n*b.d-b.n*a.d}/${common} = ${show(answer)}.`;meta={a,b};break;}
 case 'of':{a=rReduced(r,2,upper);t=pick(r,2,difficulty==='challenge'?11:6);const total=a.d*t;answer=F(a.n*t,1);prompt=`What is ${show(a)} of ${total}?`;explanation=`Divide ${total} by ${a.d} to get ${t}, then multiply ${t} by ${a.n}. Answer: ${a.n*t}.`;meta={a,total};break;}
 case 'mixed':{let whole=pick(r,1,difficulty==='challenge'?7:4);a=rReduced(r,2,upper);answer=F(whole*a.d+a.n,a.d);prompt=`Write ${whole} ${show(a)} as an improper fraction.`;explanation=`Multiply the whole number by the denominator, then add the numerator: (${whole} × ${a.d} + ${a.n})/${a.d} = ${show(answer)}.`;meta={whole,a};break;}
 default:throw Error('Unsupported skill');
 }
 return {skill,prompt,answer:typeof answer==='string'?answer:show(answer),explanation,meta,kind:typeof answer==='string'?'comparison':'fraction'};
}
function makeSet({skill='equivalent',difficulty='standard',count=10,seed='classroom'}={}){
 if(!SKILLS.some(s=>s.id===skill)&&skill!=='mixed-review')throw Error('Unknown skill');
 count=Math.max(1,Math.min(40,Number(count)||10));const r=random(seed+'|'+skill+'|'+difficulty);const out=[];
 for(let i=0;i<count;i++){const s=skill==='mixed-review'?SKILLS[i%SKILLS.length].id:skill;const q=one(s,difficulty,r);out.push({...q,id:'q'+(i+1),number:i+1});}
 return out;
}
function isCorrect(q,input){if(q.kind==='comparison')return String(input||'').trim().replace('≤','<').replace('≥','>')===q.answer;const value=parse(input),expected=parse(q.answer);return Boolean(value&&expected&&compare(value,expected)===0)}
function verify(q){const m=q.meta;let answer;
 switch(q.skill){case'equivalent':answer=F(m.a.n*m.t,1);break;case'simplify':answer=m.a;break;case'compare':answer=compare(m.a,m.b)<0?'<':compare(m.a,m.b)>0?'>':'=';break;case'add':answer=add(m.a,m.b);break;case'subtract':answer=subtract(m.a,m.b);break;case'of':answer=mul(m.a,F(m.total));break;case'mixed':answer=F(m.whole*m.a.d+m.a.n,m.a.d);break;default:return false}return (typeof answer==='string'?answer:show(answer))===q.answer;}
global.TeacherMath={SKILLS,makeSet,isCorrect,verify,parse,F,add,subtract,mul,compare,show,random};
if(typeof module!=='undefined'&&module.exports)module.exports=global.TeacherMath;
})(typeof window!=='undefined'?window:globalThis);
