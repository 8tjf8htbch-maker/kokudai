/* Browser-only analysis for 國大練習. No fetch, storage, logging, or external AI calls. */
(function(){
  'use strict';
  function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
  function isWin(v){return v===true||v===1||v==='win';}
  function summary(rows){
    const total=rows.length,wins=rows.filter(r=>isWin(r.win)).length;
    const margins=rows.filter(r=>r.margin!==null&&r.margin!==undefined).map(r=>num(r.margin));
    return {total,wins,losses:total-wins,winRate:total?wins/total:null,avgMargin:margins.length?margins.reduce((a,b)=>a+b,0)/margins.length:null};
  }
  function validDate(v){const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))?s:'';}
  function analyze(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    const target=payload.targetPlayer||{},rows=Array.isArray(payload.recentResults)?payload.recentResults.filter(r=>r&&typeof r==='object'):[];
    const tournaments=Array.isArray(payload.tournamentResults)?payload.tournamentResults.filter(r=>r&&typeof r==='object'):[];
    const ps=payload.practiceSummary&&typeof payload.practiceSummary==='object'?payload.practiceSummary:summary(rows);
    const ts=payload.tournamentSummary&&typeof payload.tournamentSummary==='object'?payload.tournamentSummary:summary(tournaments);
    const insights=[],suggestions=[];
    const total=num(ps.total,rows.length),wins=num(ps.wins,summary(rows).wins),rate=ps.winRate===null?null:(ps.winRate===undefined?(total?wins/total:null):num(ps.winRate));
    if(total<5){insights.push('練習試合の記録がまだ少ないため、現時点の傾向は参考値です。');suggestions.push('まずは練習試合の結果を継続して記録し、判断材料を増やしましょう。');}
    else if(rate!==null)insights.push('記録上の練習勝率は'+Math.round(rate*100)+'%です（'+total+'試合）。');
    const ordered=rows.filter(r=>validDate(r.date)).slice().sort((a,b)=>validDate(a.date).localeCompare(validDate(b.date)));
    const recent=summary(ordered.slice(-10)),previous=summary(ordered.slice(-20,-10));
    const change=recent.winRate!==null&&previous.winRate!==null?recent.winRate-previous.winRate:null;
    if(change!==null&&recent.total>=5&&previous.total>=5){
      if(change>=.15)insights.push('直近10試合の勝率は、その前の期間より上がっています。');
      else if(change<=-.15)insights.push('直近10試合の勝率は、その前の期間より下がっています。練習テーマや相手の変化も合わせて確認しましょう。');
      else insights.push('直近とその前の期間で、勝率に大きな差は見られません。');
    }
    let opponents=[];
    if(Array.isArray(payload.opponentSummary)){
      opponents=payload.opponentSummary.filter(o=>o&&typeof o==='object'&&String(o.name||'').trim()).map(o=>{
        const n=num(o.total),w=num(o.wins),wr=o.winRate===null||o.winRate===undefined?(n?w/n:null):num(o.winRate);
        return {name:String(o.name),rank:String(o.rank||'不明'),total:n,wins:w,losses:num(o.losses,Math.max(0,n-w)),winRate:wr,avgMargin:num(o.avgMargin),reliability:n<3?'参考値':'一定の参考情報'};
      });
    }else{
      const groups=new Map();
      rows.forEach(r=>{const name=String(r.opponent||'').trim();if(!name)return;if(!groups.has(name))groups.set(name,[]);groups.get(name).push(r);});
      opponents=[...groups.entries()].map(([name,items])=>({name,rank:String(items[items.length-1].opponentRank||'不明'),...summary(items),reliability:items.length<3?'参考値':'一定の参考情報'}));
    }
    opponents.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ja'));
    const sampled=opponents.filter(o=>o.total>=3&&o.winRate!==null);
    if(sampled.length){
      const low=sampled.reduce((a,b)=>b.winRate<a.winRate?b:a),high=sampled.reduce((a,b)=>b.winRate>a.winRate?b:a);
      insights.push(low.name+'さんとの対戦は'+low.total+'試合中'+low.wins+'勝です。相性の判断は対戦数も踏まえてください。');
      if(high.name!==low.name)insights.push(high.name+'さんとの対戦は'+high.total+'試合中'+high.wins+'勝です。');
    }
    if(opponents.length>=2){const most=opponents.reduce((a,b)=>b.total>a.total?b:a);if(most.total>=3)suggestions.push('対戦が多い'+most.name+'さん以外の相手とも組み、経験する相手を広げてみましょう。');}
    const margins=rows.filter(r=>r.margin!==null&&r.margin!==undefined).map(r=>num(r.margin));
    if(margins.length>=5)insights.push('記録上の平均枚差は'+(margins.reduce((a,b)=>a+b,0)/margins.length).toFixed(1)+'枚です。勝敗だけでなく、枚差の推移も確認しましょう。');
    if(!suggestions.length)suggestions.push('次回は練習テーマを一つ決め、試合後に気づきをメモして記録と照らし合わせましょう。');
    return {engine:'kokudai-browser-stats-v1',externalApiUsed:false,targetPlayer:{name:String(target.name||'対象選手'),rank:String(target.rank||'不明')},practiceSummary:ps,tournamentSummary:ts,trend:{recent,previous,winRateChange:change},opponents,insights,suggestions,limitations:['分析はこの端末のブラウザ内で実行します。記録を分析用サーバーや生成AI APIへ送信しません。','これは記録に基づく統計分析で、試合の原因や選手の実力を断定するものではありません。','対戦数が少ない相手の勝率は大きく変動するため、参考値として扱ってください。','現段階では機械学習による勝敗予測は行っていません。']};
  }
  window.KOKUDAI_LOCAL_ANALYSIS={analyze};
})();