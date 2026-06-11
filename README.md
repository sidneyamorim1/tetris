# Tetris Clássico

Um Tetris para navegador com visual retrô, controles para desktop e celular, som gerado no próprio jogo e peças bônus que deixam a partida mais dinâmica.

## Como jogar

- `Seta esquerda` e `Seta direita`: movem a peça
- `Espaço`: gira a peça
- `Enter`: queda rápida
- `Seta para baixo`: desce a peça
- `P`: pausa ou continua
- `R`: reinicia a partida

No celular, use os botões de toque na parte inferior da tela.

## Recursos

- 7 peças clássicas do Tetris
- peças bônus que entram em níveis mais altos
- música rápida quando uma peça bônus aparece
- efeito visual ao perder
- som ligado/desligado por botão
- layout responsivo para celular

## Como rodar localmente

Abra a pasta do projeto e execute:

```bash
npm start
```

Depois acesse no navegador:

```text
http://127.0.0.1:5500
```

## Estrutura

- `index.html`: interface do jogo
- `styles.css`: visual e responsividade
- `app.js`: lógica do Tetris, som e efeitos
- `server.js`: servidor local simples

## Observações

- O jogo usa áudio do navegador, então o som começa depois da primeira interação do usuário.
- As peças bônus aparecem conforme o nível aumenta e trazem efeitos visuais e musicais próprios.
