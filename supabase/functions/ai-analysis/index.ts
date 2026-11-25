// 國大練習 - AI分析 Supabase Edge Function
// APIキーはこのファイルやGitHubには書かず、Supabase Edge Function Secrets に設定してください。
// - GEMINI_API_KEY: Google AI Studio / Gemini APIのAPIキー（メイン）
// - GROQ_API_KEY: Groq APIキー（任意。設定するとGeminiが失敗したときに自動で切り替えます）
// - GEMINI_MODEL / GROQ_MODEL: 任意。モデルの上書き用。

const ALLOWED_ORIGIN = 'https://8tjf8htbch-maker.github.io';

function corsHeaders(origin) {
const allowed = origin === ALLOWED_ORIGIN? origin: ALLOWED_ORIGIN;
return {
'Access-Control-Allow-Origin': allowed,
'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
'Access-Control-Allow-Methods': 'POST, OPTIONS',
'Content-Type': 'application/json; charset=utf-8',
'Vary': 'Origin'
};
}

function json(data, status, origin) {
return new Response(JSON.stringify(data), {
status,
headers: corsHeaders(origin)
});
}

function extractOutputText(response) {
return response?.choices?.[0]?.message?.content?.trim() || '';
}

function sleep(ms) {
return new Promise((resolve) => setTimeout(resolve, ms));
}

const INSTRUCTIONS = [
'あなたは競技かるたの練習記録を分析するアシスタントです。',
'目的は、選手の成長・対戦傾向・練習内容・大会準備に役立つ情報を整理することです。',
'勝率だけでなく、直近の推移、枚差、対戦相手、相手の級、対戦頻度、札分け、練習目的、練習テーマ、大会との違いを確認してください。',
'記録から直接確認できる事実と、そこから考えられる練習上の選択肢を分けて書いてください。',
'記録されていない原因を推測して断定しないでください。例えば「A級に弱い原因は守り」などとは言わないでください。',
'サンプル数が少ない場合は、傾向の信頼性が低いことを明記してください。',
'提案は「次に試せる選択肢」として提示し、唯一の正解として断定しないでください。',
'競技かるたの技術的原因を記録なしに推測せず、必要なら「追加で記録すると分析できる情報」を示してください。',
'以下の見出しで日本語で回答してください。',
'',
'',
'',
'',
'',
'',
'',
'',
'簡潔だが具体的に書いてください。'
].join('\n');

// 1回のAPI呼び出し。20秒でタイムアウト。
async function callChatApi(url, apiKey, model, payload) {
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20000);
try {
const response = await fetch(url, {
method: 'POST',
headers: {
'Authorization': 'Bearer ' + apiKey,
'Content-Type': 'application/json'
},
body: JSON.stringify({
model,
messages: [
{ role: 'system', content: INSTRUCTIONS},
{ role: 'user', content: payload}
],
max_tokens: 1400
}),
signal: controller.signal
});
const result = await response.json().catch(() => ({}));
return { response, result};
} finally {
clearTimeout(timer);
}
}

function errorDetail(result, fallback) {
const raw = result?.error?.message || result?.message || result?.error || fallback;
return typeof raw === 'string'? raw: JSON.stringify(raw);
}

// モデル一覧を順に試す。429/503は一時的なので少し待って再試行する。
// 401/403はキー自体の問題なので、そのプロバイダは即あきらめる。
async function tryProvider({ url, apiKey, models, payload, attemptsForFirst}) {
let lastError = '';
for (let i = 0; i < models.length; i++) {
const model = models[i];
const attempts = i === 0? attemptsForFirst: 1;
for (let attempt = 1; attempt <= attempts; attempt++) {
try {
const { response, result} = await callChatApi(url, apiKey, model, payload);
if (response.ok) {
const text = extractOutputText(result);
if (text) return { ok: true, model: result?.model || model, text};
lastError = '[' + model + '] AI returned no text.';
break;
}
lastError = '[' + model + ' ' + response.status + '] ' + errorDetail(result, 'Unknown error.');
if (response.status === 401 || response.status === 403) {
return { ok: false, error: lastError};
}
if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
await sleep(1200 * attempt);
continue;
}
break;
} catch (error) {
lastError = '[' + model + '] ' + (error?.message || String(error));
if (attempt < attempts) {
await sleep(1200 * attempt);
continue;
}
break;
}
}
}
return { ok: false, error: lastError};
}

function uniqueList(list) {
return [...new Set(list.filter(Boolean))];
}

Deno.serve(async (req) => {
const origin = req.headers.get('origin') || '';
if (req.method === 'OPTIONS') {
return new Response('ok', { headers: corsHeaders(origin)});
}
if (req.method!== 'POST') {
return json({ error: 'POST only'}, 405, origin);
}
if (origin && origin!== ALLOWED_ORIGIN) {
return json({ error: 'Origin not allowed'}, 403, origin);
}

const geminiKey = Deno.env.get('GEMINI_API_KEY');
const groqKey = Deno.env.get('GROQ_API_KEY');
if (!geminiKey &&!groqKey) {
return json({ error: 'No AI API key is configured in Supabase Edge Function Secrets.'}, 503, origin);
}

let body;
try {
body = await req.json();
} catch {
return json({ error: 'Invalid JSON.'}, 400, origin);
}

const data = body?.data;
if (!data || typeof data!== 'object') {
return json({ error: 'data is required.'}, 400, origin);
}

const payload = JSON.stringify(data);
const failures = [];

// メイン: Gemini（混雑しにくい軽量モデルへ自動で切り替えながら試す）
if (geminiKey) {
const models = uniqueList([
Deno.env.get('GEMINI_MODEL'),
'gemini-3.8-flash',
'gemini-2.5-flash-lite',
'gemini-2.5-flash'
]);
const gemini = await tryProvider({
url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
apiKey: geminiKey,
models,
payload,
attemptsForFirst: 2
});
if (gemini.ok) {
return json({ provider: 'gemini', model: gemini.model, analysis: gemini.text}, 200, origin);
}
failures.push('Gemini: ' + gemini.error);
}

// フォールバック: Groq（無料枠。キーが設定されている場合のみ）
if (groqKey) {
const models = uniqueList([
Deno.env.get('GROQ_MODEL'),
'llama-3.3-70b-versatile',
'llama-3.1-8b-instant'
]);
const groq = await tryProvider({
url: 'https://api.groq.com/openai/v1/chat/completions',
apiKey: groqKey,
models,
payload,
attemptsForFirst: 2
});
if (groq.ok) {
return json({ provider: 'groq', model: groq.model, analysis: groq.text}, 200, origin);
}
failures.push('Groq: ' + groq.error);
}

return json({
error: 'AI API request failed.',
detail: failures.join(' / ')
}, 502, origin);
});
