const assert = require('node:assert/strict');
const { analyze } = require('./local-analysis.js');
const result = analyze({ targetPlayer: { name: 'Synthetic Player' }, practiceSummary: { total: 6, wins: 4, losses: 2, winRate: 4/6 }, recentResults: [{win:true,margin:2},{win:false,margin:1},{win:true,margin:3},{win:true,margin:2},{win:false,margin:1},{win:true,margin:4}], opponentSummary: [{name:'Synthetic Opponent',rank:'B級',total:4,wins:3,losses:1,winRate:.75,avgMargin:2}] });
assert.equal(result.externalApiUsed, false);
assert.equal(result.engine, 'kokudai-browser-stats-v1');
assert.equal(result.opponents[0].name, 'Synthetic Opponent');
assert.ok(result.insights.length > 0);
assert.ok(result.limitations.some(x => x.includes('外部')));
console.log('Browser-local analysis tests passed.');
