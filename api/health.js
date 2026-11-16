// Diagnóstico:
//   /api/health            -> mostra se a chave existe
//   /api/health?teste=1    -> chama o Gemini de verdade
//   /api/health?modelos=1  -> lista os modelos que a sua chave pode usar
const { gemini, limited, MODELS } = require('./_gemini');

module.exports = async (req, res) => {
  const out = { ok: true, temChave: !!process.env.GEMINI_API_KEY, modelos_tentados: MODELS, node: process.version };
  const q = req.query || {};
  if (q.teste || q.modelos) {
    if (limited(req)) return res.status(429).json({ error: 'Muitos testes. Aguarde um minuto.' });
  }
  if (q.modelos) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      });
      const d = await r.json();
      if (!r.ok) { out.ok = false; out.erro = d.error?.message || 'Erro ' + r.status; }
      out.modelos_disponiveis = (d.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace('models/', ''));
    } catch (e) { out.ok = false; out.erro = e.message; }
  }
  if (q.teste) {
    const t = Date.now();
    try {
      out.resposta = (await gemini({
        system: 'Responda em português do Brasil.',
        contents: [{ role: 'user', parts: [{ text: 'Diga apenas: ok' }] }],
        temperature: 0,
      })).trim();
    } catch (e) { out.ok = false; out.erro = e.message; }
    out.ms = Date.now() - t;
  }
  res.status(200).json(out);
};
