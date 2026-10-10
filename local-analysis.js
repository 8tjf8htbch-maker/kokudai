/* Browser-only statistics. This module intentionally makes no network requests. */
(function(root){
'use strict';
function n(v){var x=Number(v);return Number.isFinite(x)?x:0;}
function win(r){return !!r&&(r.win===true||r.win===1||r.win==='win');}
function summarize(rows){var total=rows.length,wins=rows.filter(win).length,m=rows.filter(function(r){return r.margin!=null;}).map(function(r){return n(r.margin);});return {total:total,wins:wins,losses:total-wins,winRate:total?wins/total:null,avgMargin:m.length?m.reduce(function(a,b){return a+b;},0)/m.length:null};}
function analyze(payload){
 payload=payload&&typeof payload==='object'?payload:{};
 var rows=Array.isArray(payload.recentResults)?payload.recentResults.filter(function(r){return r&&typeof r==='object';}):[];
 var tour=Array.isArray(payload.tournamentResults)?payload.tournamentResults.filter(function(r){return r&&typeof r==='object';}):[];
 var practice=payload.practiceSummary&&typeof payload.practiceSummary==='object'?payload.practiceSummary:summarize(rows);
 var tournament=payload.tournamentSummary&&typeof payload.tournamentSummary==='object'?payload.tournamentSummary:summarize(tour);
 var insights=[],suggestions=[],trend=null;
 if(n(practice.total)<5){insights.push('練習試合の記録がまだ少ないため、現時点の傾向は参考値です。');suggestions.push('まずは練習試合の結果を継続して記録し、判断材料を増やしましょう。');}
 else if(practice.winRate!=null){insights.push('記録上の練習勝率は'+Math.round(n(practice.winRate)*100)+'%です（'+n(practice.total)+'試合）。');}
 if(rows.length>=10){
   var previous=summarize(rows.slice(-10,-5)),recent=summarize(rows.slice(-5));
   trend={previous:previous,recent:recent,winRateChange:previous.winRate==null||recent.winRate==null?null:recent.winRate-previous.winRate};
   if(trend.winRateChange!=null){
     var direction=trend.winRateChange>0?'上がっています':trend.winRateChange<0?'下がっています':'同じです';
     insights.push('直近5試合の勝率は'+Math.round(recent.winRate*100)+'%、その前の5試合は'+Math.round(previous.winRate*100)+'%で、'+direction+'。試合数が少ないため短期的な変動として見てください。');
     if(trend.winRateChange<0)suggestions.push('直近5試合で試した練習テーマや相手の級を振り返り、次回は確認したい点を一つ決めてみましょう。');
   }
 }
 if(n(tournament.total)>0&&tournament.winRate!=null)insights.push('大会記録は'+n(tournament.total)+'試合中'+n(tournament.wins)+'勝、勝率'+Math.round(n(tournament.winRate)*100)+'%です。練習記録とは分けて確認しましょう。');
 var opponents=Array.isArray(payload.opponentSummary)?payload.opponentSummary.filter(function(o){return o&&o.name;}).map(function(o){var total=n(o.total),wins=n(o.wins);return {name:String(o.name),rank:String(o.rank||'不明'),total:total,wins:wins,losses:n(o.losses),winRate:o.winRate==null?(total?wins/total:null):n(o.winRate),avgMargin:n(o.avgMargin)};}).sort(function(a,b){return b.total-a.total||a.name.localeCompare(b.name,'ja');}):[];
 var enough=opponents.filter(function(o){return o.total>=3&&o.winRate!=null;});
 if(enough.length){var low=enough.reduce(function(a,b){return a.winRate<=b.winRate?a:b;}),high=enough.reduce(function(a,b){return a.winRate>=b.winRate?a:b;});insights.push(low.name+'さんとの対戦は'+low.total+'試合中'+low.wins+'勝です。相性の判断は対戦数も踏まえてください。');if(high.name!==low.name)insights.push(high.name+'さんとの対戦は'+high.total+'試合中'+high.wins+'勝です。');}
 if(opponents.length>1){var most=opponents[0];if(most.total>=3)suggestions.push('対戦が多い'+most.name+'さん以外の相手とも組み、経験する相手を広げてみましょう。');}
 var margins=rows.filter(function(r){return r.margin!=null;}).map(function(r){return n(r.margin);});
 if(margins.length>=5)insights.push('分析対象の直近'+margins.length+'試合の平均枚差は'+(margins.reduce(function(a,b){return a+b;},0)/margins.length).toFixed(1)+'枚です。勝敗だけでなく、枚差の推移も確認しましょう。');
 if(!suggestions.length)suggestions.push('次回は練習テーマを一つ決め、試合後に気づきをメモして記録と照らし合わせましょう。');
 return {engine:'kokudai-browser-stats-v1',externalApiUsed:false,targetPlayer:payload.targetPlayer||{},practiceSummary:practice,tournamentSummary:tournament,trend:trend,opponents:opponents,insights:insights,suggestions:suggestions,limitations:['分析処理はこの端末内で実行し、分析データを外部の生成AI APIへ送信しません。','記録に基づく統計であり、試合の原因や選手の実力を断定するものではありません。','対戦数が少ない相手の勝率は大きく変動するため、参考値として扱ってください。','直近の勝率比較は各5試合の比較で、練習内容や相手の違いまでは補正していません。','現段階では機械学習による勝敗予測は行っていません.']};
}
root.KOKUDAI_LOCAL_ANALYSIS={analyze:analyze};
if(typeof module!=='undefined'&&module.exports)module.exports={analyze:analyze};
})(typeof window!=='undefined'?window:globalThis);
