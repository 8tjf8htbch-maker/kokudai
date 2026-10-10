const assert = require('node:assert/strict');
const { analyze } = require('./local-analysis.js');

const rows = [
  { win: false, margin: -2 }, { win: true, margin: 2 },
  { win: false, margin: -1 }, { win: true, margin: 3 },
  { win: false, margin: -2 }, // previous five: 2 wins
  { win: true, margin: 1 }, { win: true, margin: 2 },
  { win: true, margin: 3 }, { win: false, margin: -1 },
  { win: true, margin: 4 } // recent five: 4 wins
];
const result = analyze({
  targetPlayer: { name: 'Synthetic Player' },
  practiceSummary: { total: 10, wins: 6, losses: 4, winRate: 0.6 },
  recentResults: rows,
  opponentSummary: [{ name: 'Synthetic Opponent', rank: 'B級', total: 4, wins: 3, losses: 1, winRate: 0.75, avgMargin: 2 }],
  tournamentSummary: { total: 2, wins: 1, losses: 1, winRate: 0.5 },
  tournamentResults: []
});
assert.equal(result.externalApiUsed, false);
assert.equal(result.engine, 'kokudai-browser-stats-v1');
assert.equal(result.opponents[0].name, 'Synthetic Opponent');
assert.ok(result.insights.some(x => x.includes('直近5試合の勝率')));
assert.equal(result.trend.previous.wins, 2);
assert.equal(result.trend.recent.wins, 4);
assert.ok(result.insights.some(x => x.includes('大会記録')));
assert.ok(result.limitations.some(x => x.includes('外部')));
console.log('Browser-local analysis tests passed.');
