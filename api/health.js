// Diagnóstico: abra /api/health  (e /api/health?teste=1 para testar o Gemini de verdade)
const { gemini, limited, MODEL } = require('./_gemini');

module.exports = async (req, res) => {
  const out = { ok: true, temChave: !!process.env.GEMINI_API_KEY, modelo: MODEL, node: process.version };
  if (req.query && req.query.teste) {
    if (limited(req)) return res.status(429).json({ error: 'Muitos testes. Aguarde um minuto.' });
    const t = Date.now();
    try {
      out.resposta = (
        await gemini({
          system: 'Responda em português do Brasil.',
          contents: [{ role: 'user', parts: [{ text: 'Diga apenas: ok' }] }],
          temperature: 0,
        })
      ).trim();
    } catch (e) {
      out.ok = false;
      out.erro = e.message;
    }
    out.ms = Date.now() - t;
  }
  res.status(200).json(out);
};
