export interface WordEntry {
  id: string;
  word: string;
  origin: string;
  phonetic: string;
  definition: string;
  inesNote: string;
  inkSvg: string;
}

export interface MemoryObjectEntry {
  id: string;
  title: string;
  chapter: string;
  location: string;
  description: string;
}

export interface CharacterBioEntry {
  id: string;
  name: string;
  age: string;
  role: string;
  quote: string;
  bio: string;
  secretHint: string;
  sprite?: string;
}

export const CHARACTER_DIRECTORY: Record<string, { displayName: string; color: string }> = {
  ines: { displayName: 'Inês', color: '#e6d7b8' },
  celeste: { displayName: 'Avó Celeste', color: '#f2c14e' },
  duarte: { displayName: 'Duarte', color: '#9fc3d6' },
  mara: { displayName: 'Mara', color: '#b8d8d8' },
  anselmo: { displayName: 'Padre Anselmo', color: '#d1c7b7' },
  rui: { displayName: 'Rui Sequeira', color: '#d99b66' },
  graca: { displayName: 'Dona Graça', color: '#c9d6a3' },
  joaquim: { displayName: 'Chefe da Estação', color: '#b5c2cc' },
  luz: { displayName: 'A Luz', color: '#ffe38f' },
};

export const NOTEBOOK_WORDS: WordEntry[] = [
  {
    id: 'saudade',
    word: 'Saudade',
    origin: 'Português',
    phonetic: '/sɐw.ˈda.dɨ/',
    definition: 'Presença teimosa de quem falta; dor que prova que o amor existiu.',
    inesNote:
      'Escrevi esta palavra na primeira página do caderno, no comboio das seis da manhã, há dez anos. Tinha sal nos dedos e não sabia porquê.',
    inkSvg: `<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 58 Q36 48 60 58 T108 56"/><path d="M56 56 L58 22 L64 22 L66 56"/><circle cx="61" cy="18" r="3"/><path d="M64 18 L106 8 M64 18 L106 28" stroke-dasharray="3 3"/></svg>`,
  },
  {
    id: 'abracadouro',
    word: 'Abraçadouro',
    origin: 'Português (regionalismo inventado na costa)',
    phonetic: '/ɐ.bɾɐ.sɐ.ˈdow.ɾu/',
    definition: 'Cais pequeno onde só cabem duas pessoas a despedir-se ou a esperar.',
    inesNote:
      'A avó usava esta palavra para o degrau da porta da cozinha. «Não fiques no abraçadouro ao frio, ou entras ou vais ao mar.»',
    inkSvg: `<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 48 L78 48 L78 62"/><path d="M14 62 Q45 55 76 62 T112 60"/><circle cx="66" cy="36" r="4"/><path d="M66 40 L66 48"/></svg>`,
  },
  {
    id: 'hiraeth',
    word: 'Hiraeth',
    origin: 'Galês',
    phonetic: '/ˈhɪr.aɪθ/',
    definition: 'Nostalgia por uma casa à qual não se pode voltar — ou que talvez nunca tenha sido como a lembramos.',
    inesNote:
      'Névoa inteira cabe aqui dentro: uma vila caiada de branco onde as cadeiras estão viradas de costas para a água.',
    inkSvg: `<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M30 58 L30 34 L48 20 L66 34 L66 58 Z"/><rect x="44" y="42" width="8" height="16"/><path d="M12 62 L108 62"/></svg>`,
  },
  {
    id: 'mono_no_aware',
    word: 'Mono no aware',
    origin: 'Japonês (物の哀れ)',
    phonetic: '/mo.no no a.wa.ɾe/',
    definition: 'A empatia serena pelas coisas que passam; a beleza que só existe porque tudo é efémero.',
    inesNote:
      'Uma cama sem lençóis não é um móvel vazio. É uma frase interrompida a meio.',
    inkSvg: `<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 52 L98 52 M22 40 L22 60 M98 44 L98 60"/><path d="M22 48 Q60 44 98 48" stroke-dasharray="4 3"/></svg>`,
  },
  {
    id: 'toska',
    word: 'Toska',
    origin: 'Russo (тоска)',
    phonetic: '/tɐˈska/',
    definition: 'Angústia espiritual sem causa visível; uma dor surda na alma quando nada parece faltar mas falta tudo.',
    inesNote:
      'O sorriso do Duarte quando leva a mão ao peito e toca num anel que não sabe de quem é.',
    inkSvg: `<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="60" cy="44" r="16"/><path d="M60 12 Q52 24 60 28 Q68 24 60 12"/></svg>`,
  },
  {
    id: 'fernweh',
    word: 'Fernweh',
    origin: 'Alemão',
    phonetic: '/ˈfɛʁn.veː/',
    definition: 'Dor de estar longe; o oposto da saudade de casa — a urgência de fugir para um lugar onde ninguém saiba o nosso nome.',
    inesNote:
      'Achei durante dez anos que tinha fugido por ambição. Chama-se covardia quando traduzimos sem dicionário.',
    inkSvg: `<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 64 L54 22 M108 64 L66 22"/><path d="M36 52 L84 52 M44 38 L76 38"/></svg>`,
  },
];

export const MEMORY_OBJECTS: MemoryObjectEntry[] = [
  {
    id: 'mem_postal_celeste',
    title: 'O Postal Sem Selo',
    chapter: 'Prólogo',
    location: 'Comboio regional',
    description: 'Letra trémula da avó Celeste a tinta azul: «Vem. Antes da próxima maré.»',
  },
  {
    id: 'mem_cama_vazia',
    title: 'O Colchão Riscado',
    chapter: 'Prólogo',
    location: 'Quarto de infância',
    description: 'A segunda cama do quarto, sem lençóis, com uma marca de sal seca na madeira da cabeceira.',
  },
  {
    id: 'mem_desenho_barco',
    title: 'Desenho de Cera Azul',
    chapter: 'Prólogo',
    location: 'Quarto de infância',
    description: 'Um barco torto colado na parede com fita-cola amarelada. No canto inferior, o nome foi raspado com uma unha.',
  },
  {
    id: 'mem_buzio_janela',
    title: 'O Búzio no Parapeito',
    chapter: 'Prólogo',
    location: 'Quarto de infância',
    description: 'Um búzio branco pousado junto ao fecho da janela. Cheira a maresia recente, como se alguém o tivesse trazido ontem.',
  },
];

export const CHARACTER_BIOS: CharacterBioEntry[] = [
  {
    id: 'ines',
    name: 'Inês Vale',
    age: '29 anos',
    role: 'Tradutora em Lisboa',
    quote: '«Há palavras que não têm tradução porque ninguém quer admitir que precisou delas.»',
    bio: 'Fugiu de Névoa aos dezanove anos no primeiro comboio da manhã. Vive em quartos alugados onde nunca prega quadros na parede. Anda sempre com um caderno de capa preta.',
    secretHint: 'Nas noites de trovoada acorda a olhar para a janela, à espera de três batidas.',
  },
  {
    id: 'celeste',
    name: 'Avó Celeste',
    age: '78 anos',
    role: 'Guardiã do Farol de Névoa',
    quote: '«O mar não devolve nada, filha. Só empresta até se arrepender.»',
    bio: 'Guardiã do farol há cinquenta anos. Sobe os cento e quarenta degraus todas as tardes com a chave de latão ao pescoço. Põe sempre uma chávena a mais na mesa.',
    secretHint: 'É a única pessoa da vila que nunca fecha as cortinas viradas ao mar.',
    sprite: './assets/sprites/celeste_neutra.webp',
  },
  {
    id: 'duarte',
    name: 'Duarte Matos',
    age: '31 anos',
    role: 'Pescador',
    quote: '«A gente aqui acorda leve, Inês. Não me peças para explicar o que não dói.»',
    bio: 'Amigo de infância de Inês. Sorri com facilidade, conhece os ventos pelo cheiro e traz ao pescoço uma aliança num cordel que jura ter achado na areia.',
    secretHint: 'O barco dele chama-se Lúcia, mas ele diz que já vinha com o nome quando o comprou.',
  },
  {
    id: 'mara',
    name: 'Mara',
    age: 'Aparenta 9 anos',
    role: 'Rapariga nas dunas',
    quote: '«Três batidas é o código. Tu é que te esqueceste da senha.»',
    bio: 'Aparece descalça nas dunas quando a névoa engrossa. O vestido parece molhado mas nunca pinga. Ninguém na vila olha para ela senão Inês.',
    secretHint: 'Faz castelos de areia com dois fossos — exatamente como nos desenhos colados no quarto do farol.',
  },
];
