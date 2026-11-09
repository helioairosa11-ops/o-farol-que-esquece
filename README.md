# O Farol que Esquece

Visual novel 2D em português europeu sobre o luto, a memória e o direito de sentir dor.

> *Dez anos depois de fugir, Inês regressa à vila costeira de Névoa para se despedir da avó, guardiã do farol. Descobre que a luz do farol apaga, em cada tempestade, a memória de quem o mar levou — para que a vila deixe de sofrer. E que ela própria esqueceu alguém.*

## Como correr o projeto

```bash
npm install
npm run dev
```

Para validar os scripts, correr os testes unitários e gerar a build de produção:

```bash
npm run validate
npm test
npm run build
```

## Controlos
- **Clique / Espaço / Enter**: Avançar diálogo (ou concluir efeito máquina de escrever)
- **Backspace / Seta Esquerda**: Recuar uma linha ou decisão (*Rewind*)
- **H / Seta Cima / Swipe para cima**: Abrir Histórico (*Backlog*)
- **A**: Alternar modo Automático
- **S**: Alternar modo Saltar (apenas texto já lido)
- **F5 / F9**: Guardar rápido / Carregamento rápido

## Configuração de autoria
O nome do autor exibido nos créditos é configurável em [`config.json`](../config.json) através da propriedade `AUTHOR_NAME`.
