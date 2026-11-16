// Ajudante compartilhado. O arquivo começa com "_" para o Vercel NÃO criar uma rota para ele.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// Limite simples por IP (melhor esforço): 20 pedidos por minuto.
const hits = new Map();
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

async function gemini({ system, contents, json = false, temperature = 0.9 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não está configurada no Vercel.');
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `Erro do Gemini (${r.status})`);
  const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error('O Gemini não devolveu texto (pode ter sido bloqueado por segurança).');
  return text;
}

module.exports = { gemini, limited };
