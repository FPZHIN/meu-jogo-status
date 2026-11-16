// Ajudante compartilhado. O arquivo começa com "_" para o Vercel NÃO criar uma rota para ele.
// Modelos tentados em ordem. Para trocar, crie a variável GEMINI_MODELS no Vercel (separada por vírgula).
const MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-flash-latest,gemini-flash-lite-latest')
  .split(',').map((s) => s.trim()).filter(Boolean);

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

class Fatal extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gemini({ system, contents, json = false, temperature = 0.9 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não está configurada no Vercel (faça Redeploy depois de adicionar).');
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  });

  const t0 = Date.now();
  let lastErr = 'Erro desconhecido';
  for (const model of MODELS) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const left = 27000 - (Date.now() - t0); // o Vercel corta a função em 30s
      if (left < 3000) throw new Error(lastErr + ' (tempo esgotado; tente de novo em instantes)');
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            signal: AbortSignal.timeout(Math.min(12000, left)),
            body,
          }
        );
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
          if (text) return text;
          lastErr = 'O Gemini não devolveu texto (pode ter sido bloqueado por segurança).';
          break;
        }
        lastErr = d.error?.message || `Erro do Gemini (${r.status})`;
        // Sobrecarga (429/5xx): tenta de novo e depois o próximo modelo. Outros erros (chave, pedido) param aqui.
        if (r.status === 429 || r.status >= 500) { await sleep(700); continue; }
        if (r.status === 404) break; // modelo não existe: passa para o próximo
        throw new Fatal(lastErr);
      } catch (e) {
        if (e instanceof Fatal) throw e;
        lastErr = e.name === 'TimeoutError' || e.name === 'AbortError'
          ? 'O Gemini demorou para responder.' : 'Falha ao falar com o Gemini: ' + e.message;
      }
    }
  }
  throw new Error(`${lastErr} (modelos tentados: ${MODELS.join(', ')})`);
}

module.exports = { gemini, limited, MODELS };
