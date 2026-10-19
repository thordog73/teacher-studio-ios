const assert=require('node:assert/strict');
const M=require('../web/math.js');
assert.deepEqual(M.F(10,20),{n:1,d:2});
assert.equal(M.isCorrect({kind:'fraction',answer:'3/4'},'0.75'),true);
assert.equal(M.isCorrect({kind:'fraction',answer:'5/3'},'1 2/3'),true);
assert.equal(M.isCorrect({kind:'fraction',answer:'1/2'},'1/3'),false);
assert.equal(M.parse('1/0'),null);
let checked=0;
for(const skill of [...M.SKILLS.map(x=>x.id),'mixed-review']){
 for(const difficulty of ['easy','standard','challenge']){
  for(let i=0;i<70;i++){
   const seed='run-'+i;
   const questions=M.makeSet({skill,difficulty,count:40,seed});
   assert.deepEqual(questions,M.makeSet({skill,difficulty,count:40,seed}),'seed deterministic');
   for(const q of questions){assert.equal(M.verify(q),true,JSON.stringify(q));assert.equal(M.isCorrect(q,q.answer),true);checked++}
  }
 }
}
console.log(`PASS: ${checked.toLocaleString()} generated questions independently recomputed and round-trip checked.`);
