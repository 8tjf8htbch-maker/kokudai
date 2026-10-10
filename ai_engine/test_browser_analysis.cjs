const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('local-analysis.js', 'utf8'), context, { timeout: 1000 });
const analyze = context.window.KOKUDAI_LOCAL_ANALYSIS.analyze;
const result = analyze({
  targetPlayer: { name: 'Synthetic Player', rank: 'B級' },
  practiceSummary: { total: 6, wins: 4, losses: 2, winRate: 4 / 6, avgMargin: 2 },
  recentResults: [
    { date: '2026-09-01', win: true, opponent: 'Synthetic A', opponentRank: 'B級', margin: 2 },
    { date: '2026-09-02', win: true, opponent: 'Synthetic A', opponentRank: 'B級', margin: 3 },
    { date: '2026-09-03', win: false, opponent: 'Synthetic A', opponentRank: 'B級', margin: -1 },
    { date: '2026-09-04', win: true, opponent: 'Synthetic B', opponentRank: 'C級', margin: 4 },
    { date: '2026-09-05', win: false, opponent: 'Synthetic B', opponentRank: 'C級', margin: -2 },
    { date: '2026-09-06', win: true, opponent: 'Synthetic B', opponentRank: 'C級', margin: 3 }
  ],
  opponentSummary: [
    { name: 'Synthetic A', rank: 'B級', total: 3, wins: 2, losses: 1, winRate: 2 / 3, avgMargin: 1.3 },
    { name: 'Synthetic B', rank: 'C級', total: 3, wins: 2, losses: 1, winRate: 2 / 3, avgMargin: 1.7 }
  ],
  tournamentSummary: { total: 0, wins: 0, losses: 0, winRate: null },
  tournamentResults: []
});
assert.equal(result.engine, 'kokudai-browser-stats-v1');
assert.equal(result.externalApiUsed, false);
assert.equal(result.targetPlayer.name, 'Synthetic Player');
assert.equal(result.practiceSummary.total, 6);
assert.equal(result.opponents.length, 2);
assert.ok(result.insights.length > 0);
assert.ok(result.suggestions.length > 0);
assert.ok(result.limitations.some(text => text.includes('生成AI APIへ記録を送信しません')));
console.log('Browser-local analysis tests passed (synthetic data only).');
