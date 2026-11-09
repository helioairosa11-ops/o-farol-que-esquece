# Art Bible — O Farol que Esquece

## 1. Estilo
**Gouache + tinta sobre papel de aguarela prensado a frio.** Contornos irregulares a tinta (não vetoriais), pinceladas opacas visíveis, grão de papel sempre presente. Cor controlada: cada capítulo tem uma paleta de 4–5 cores + **um único acento quente**. Personagens semi-realistas estilizados: proporções elegantes, rostos expressivos, mãos com peso. **Nunca** anime genérico, 3D ou fotografia.

### Prompt-base (prefixo obrigatório de todas as gerações)
```
gouache and ink painting on textured cold-press watercolor paper, irregular hand-drawn ink outlines,
visible opaque brush strokes, paper grain visible, restrained controlled palette, painterly,
melancholic but warm, Portuguese coastal village, semi-realistic stylized (elegant proportions,
NOT anime, NOT 3D, NOT photo), no text, no letters, no signage writing, no watermark, no signature
```

## 2. Paletas por capítulo
| Capítulo | Cores base (HEX) | Acento | Luz |
|---|---|---|---|
| Prólogo — Maré Vazia | `#2E3A46` `#4A5866` `#7D8C99` `#C3CCD3` | amarelo-farol `#F2C14E` | Névoa difusa, sem sombras duras; o único calor vem de lâmpadas e do feixe. |
| Cap. 1 — A Vila Que Sorri | `#F4EFE6` (cal) `#DCE6E4` `#E9D8C4` `#A9C2C9` | azul-barra `#3F6E8C` | Sol pálido de novembro, sombras azuladas curtas, brancos lavados. |
| Cap. 2 — O Livro das Marés | `#6B5A2E` (ocre) `#8A7A3C` `#4F5D3A` (musgo) `#2B2A1F` | vela `#F0A64A` | Interiores quentes de vela, cantos escuros, poeira dourada. |
| Cap. 3 — A Escada do Farol | `#0F3A44` (petróleo) `#16525E` `#0A2328` `#5E8C8F` | feixe dourado `#FFD27A` | Escuridão azul profunda cortada por feixes nítidos com bloom. |
| Cap. 4 — A Noite da Tempestade | `#0B1016` `#1A2430` `#3B4B5C` `#E8F1F8` (relâmpago) | vermelho-candeeiro `#C8352B` | Contraluz, relâmpagos que achatam tudo a branco, o candeeiro é o único quente. |
| Final Lembrar | `#E9C46A` `#A8C5D6` `#F6F1E7` | ouro `#D9A441` | Manhã limpa, ouro e azul lavado. |
| Final Esquecer | `#9AA3A8` `#C9CED1` `#6E777C` | — (sem acento) | Prata baça, luz sem direção. |
| Final Equilíbrio | `#E07A3F` `#F2B880` `#5B6C8F` | laranja `#F28C38` | Pôr-do-sol, maré a subir devagar. |
| Final Fuga | `#3A4450` `#59636E` `#8A949E` | amarelo-farol fraco | Igual ao prólogo, mais escuro. Circularidade. |
| Secreto | `#F7E8C8` `#FFFFFF` `#9FC3D6` | rosa-concha `#E8B4A0` | Luz de papel velho, quase branca. |

## 3. Regras de luz
1. O farol é sempre a fonte de luz mais quente do enquadramento à noite.
2. O feixe tem núcleo nítido + halo (bloom em tempo real na camada de efeitos).
3. Antes de um apagamento, o feixe **pisca** (3 ciclos rápidos) — regra narrativa e visual.
4. Interiores: uma só fonte quente; o resto é preenchimento frio.
5. Momentos íntimos: desfoque de profundidade no fundo (`effect: focus`), vinheta mais forte.

## 4. Personagens — prompts-base
Formato sprite: retrato vertical, figura da cabeça a meio da coxa, **fundo branco liso** (recortado automaticamente pelo pipeline), contorno a tinta contínuo.

| Personagem | Prompt-base |
|---|---|
| Inês (29) | young Portuguese woman 29, dark brown shoulder-length hair slightly messy, pale olive skin, sharp tired eyes, long dark-navy wool coat, grey sweater, mustard scarf, small notebook in hand |
| Celeste (78) | 78-year-old Portuguese lighthouse keeper, silver-white hair in a low bun with loose strands, deep wrinkles, bright dark eyes, small and sturdy, cream hand-knitted wool cardigan over dark navy dress, black wool shawl, brass key on a cord around the neck |
| Duarte (31) | Portuguese fisherman 31, broad shoulders, short curly black hair, stubble, sunburnt skin, kind tired eyes, navy fisherman's sweater, yellow oilskin jacket open, a wedding ring on a cord around his neck |
| Mara (~9) | girl about 9, wild salt-stiff light-brown hair with tiny shells, bare feet, simple blue-grey dress that looks wet but never drips, curious mischievous eyes, slightly translucent edges |
| Padre Anselmo (66) | Portuguese priest 66, thin, white short beard, round wire glasses, black cassock with a worn grey wool cardigan over it, gentle tired face, holding an old book |
| Rui Sequeira (52) | Portuguese mayor 52, well-fed, salt-and-pepper slicked hair, tan suit without tie, municipal pin, big practiced smile that doesn't reach the eyes |
| Dona Graça (70) | Portuguese herbalist woman 70, plump, wild grey curly hair with a pencil stuck in it, many rings, colourful knitted shawl, reading glasses on a chain, mischievous eyes |

Expressões: geradas por edição da imagem base (mesma pose, enquadramento e roupa), ver lista no `writing-bible.md`.
Animação: respiração (escala vertical 0,6%), oscilação de vento, entrada/saída com fade + deslocamento. Arquitetura de camadas (`body/face/eyes/mouth/extras`) suportada pelo motor para a fase 3.

## 5. Cenários (≥18) e CGs (≥14)
**Fundos:** comboio, estação, rua principal (névoa / dia / noite), praça e igreja, café O Leme, cais dos pescadores, cozinha do farol, quarto de infância, boticária, arquivo da igreja, junta de freguesia, dunas, praia (dia / tempestade), escada do farol, sala da lanterna, cume do farol, cemitério marinho, mar aberto.

**CGs:** primeira visão do farol, Mara nas dunas, Tomás a construir o castelo, a avó a acender a luz, mão de Inês na lente, a vila na praia com lanternas, a despedida da avó, o búzio (memória 1), Duarte e o anel, Livro das Marés aberto, 4 finais + secreto.

## 6. Pipeline técnico
1. Gerar PNG em `public/assets/raw/` com o prompt-base + paleta do capítulo.
2. `npm run assets` → `tools/process-assets.mjs`: recorte do fundo branco dos sprites (flood-fill a partir das margens + suavização da orla), redimensionamento (fundos 1920×1080, sprites altura 1400), conversão para **WebP** (q 82). Saída em `public/assets/{bg,cg,sprites}`.
3. Carregamento por capítulo (`preload` das cenas seguintes), tamanho inicial alvo < 15 MB.

## 7. Efeitos (camada Canvas)
Névoa em 3 camadas de parallax, grão de filme animado, vinheta, partículas de sal, chuva, relâmpago, feixe do farol com bloom, Ken Burns subtil nos fundos (CSS), transições "pincelada" e "papel rasgado" (máscaras CSS), tremor de ecrã. Tudo desligável em *Reduzir movimento*.
