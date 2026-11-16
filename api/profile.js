const { gemini, limited } = require('./_gemini');

const cut = (x, n) => String(x || '').slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (limited(req)) return res.status(429).json({ error: 'Muitos pedidos. Aguarde um minuto.' });
  try {
    const { ideia = '', evitar = [] } = req.body || {};
    const nomes = (Array.isArray(evitar) ? evitar : []).slice(0, 60).map((n) => cut(n, 40)).join(', ');

    const system = `Você cria perfis de personagens 100% fictícios para um jogo social, em português do Brasil.
Nunca use pessoas reais, celebridades ou personagens de obras existentes. O personagem deve ser adulto (18 anos ou mais).
Responda SOMENTE com um objeto JSON, sem texto extra, com exatamente estas chaves:
{
 "nome": "nome e sobrenome brasileiros, comuns e diferentes dos já usados",
 "idade": número inteiro de 18 a 60,
 "bio": "até 140 caracteres, estilo bio de rede social",
 "personalidade": "2 a 3 frases",
 "historia": "um parágrafo curto de 4 a 6 frases",
 "interesses": ["3 a 5 itens"],
 "estilo_de_fala": "1 frase sobre como a pessoa escreve nas mensagens",
 "foto_prompt": "descrição para gerar uma foto de perfil realista, quadrada, de pessoa fictícia"
}`;
    const user = `Crie um perfil completo.${ideia ? ' Ideia do usuário: ' + cut(ideia, 200) + '.' : ' Surpreenda.'}${nomes ? ' Não use estes nomes: ' + nomes + '.' : ''}`;

    const text = await gemini({
      system,
      contents: [{ role: 'user', parts: [{ text: user }] }],
      json: true,
      temperature: 1.1,
    });
    const clean = text.replace(/^```json|```$/g, '').trim();
    let p;
    try { p = JSON.parse(clean); } catch { throw new Error('A resposta veio em formato inválido. Tente de novo.'); }
    const idade = Math.max(18, Math.min(60, parseInt(p.idade, 10) || 25));
    res.status(200).json({
      nome: cut(p.nome, 60),
      idade,
      bio: cut(p.bio, 160),
      personalidade: cut(p.personalidade, 700),
      historia: cut(p.historia, 1200),
      interesses: (Array.isArray(p.interesses) ? p.interesses : []).slice(0, 6).map((x) => cut(x, 40)),
      estilo_de_fala: cut(p.estilo_de_fala, 250),
      foto_prompt: cut(p.foto_prompt, 400),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
