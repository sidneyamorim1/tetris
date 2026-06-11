const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayBtn = document.getElementById('overlayBtn');
const gameCard = document.querySelector('.game-card');
const bonusBanner = document.getElementById('bonusBanner');

const PIECES = {
  I: { color: '#48d9ff', shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { color: '#ffe45c', shape: [[1, 1], [1, 1]] },
  T: { color: '#b388ff', shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { color: '#68ef9e', shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { color: '#ff6b8a', shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { color: '#70c8ff', shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: '#ffb864', shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  P: { color: '#9df7dd', shape: [[1, 1, 0], [1, 1, 1], [0, 0, 0]], bonus: true },
  U: { color: '#ff9ec5', shape: [[1, 0, 1], [1, 1, 1], [0, 0, 0]], bonus: true },
};

const pieceNames = Object.keys(PIECES);
const scoreTable = [0, 100, 300, 500, 800];
const levelStep = 10;
const minDropInterval = 100;
const dropDecay = 55;

let board;
let currentPiece;
let nextPiece;
let bag = [];
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let paused = false;
let dropInterval = 700;
let lastTime = 0;
let dropCounter = 0;
let audioContext = null;
let audioReady = false;
let soundEnabled = true;
let bonusActive = false;

function getAvailablePieceNames() {
  const names = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  if (level >= 5) names.push('P');
  if (level >= 8) names.push('U');
  return names;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
  if (bag.length === 0) {
    bag = getAvailablePieceNames();
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
    }
  }

  const name = bag.pop();
  return { name, color: PIECES[name].color, shape: PIECES[name].shape.map((row) => [...row]) };
}

function createPiece(piece) {
  const width = piece.shape[0].length;
  const height = piece.shape.length;
  return {
    ...piece,
    x: Math.floor(COLS / 2) - Math.ceil(width / 2),
    y: Math.min(0, 1 - height),
  };
}

function lockPiece() {
  mergePiece();
  if (currentPiece.bonus) {
    const bonusCleared = clearBonusLines(currentPiece);
    if (bonusCleared > 0) {
      lines += bonusCleared;
      score += bonusCleared * 150 * level;
      level = Math.floor(lines / levelStep) + 1;
      dropInterval = Math.max(minDropInterval, 700 - (level - 1) * dropDecay);
      updateHud();
    }
    setBonusMode(false);
  } else {
    clearLines();
  }
  spawnPiece();
  dropCounter = 0;
}

function initAudio() {
  if (!soundEnabled) return;
  if (audioReady) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = new AudioContextClass();
  audioReady = true;
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
}

function playTone(frequency, duration = 0.08, type = 'square', gainValue = 0.02) {
  if (!soundEnabled) return;
  if (!audioContext) return;
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = gainValue;
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playMoveSound() {
  initAudio();
  playTone(520, 0.025, 'square', 0.01);
}

function playRotateSound() {
  initAudio();
  playTone(740, 0.05, 'square', 0.015);
}

function playDropSound() {
  initAudio();
  playTone(220, 0.04, 'square', 0.018);
}

function playLineClearSound() {
  initAudio();
  playTone(660, 0.06, 'square', 0.02);
  window.setTimeout(() => playTone(880, 0.08, 'square', 0.02), 40);
}

function playGameOverSound() {
  initAudio();
  playTone(196, 0.12, 'square', 0.03);
  window.setTimeout(() => playTone(164, 0.12, 'square', 0.028), 110);
  window.setTimeout(() => playTone(130, 0.18, 'square', 0.025), 220);
}

function playBonusMusic() {
  initAudio();
  const melody = [880, 988, 1175, 1319, 1175, 988, 880, 988];
  melody.forEach((note, index) => {
    window.setTimeout(() => playTone(note, 0.05, 'square', 0.03), index * 65);
  });
}

function setBonusMode(active) {
  bonusActive = active;
  document.body.classList.toggle('bonus-active', active);
  bonusBanner.classList.toggle('hidden', !active);
}

function triggerGameOverEffect() {
  document.body.classList.add('game-over-active');
  window.setTimeout(() => document.body.classList.remove('game-over-active'), 800);
}

function updateSoundButton() {
  soundBtn.textContent = soundEnabled ? 'Som: ligado' : 'Som: desligado';
}

function resetGame() {
  board = createBoard();
  bag = [];
  currentPiece = createPiece(randomPiece());
  nextPiece = randomPiece();
  score = 0;
  level = 1;
  lines = 0;
  gameOver = false;
  paused = false;
  dropInterval = 700;
  dropCounter = 0;
  lastTime = 0;
  document.body.classList.remove('game-over-active');
  setBonusMode(false);
  updateHud();
  updateSoundButton();
  hideOverlay();
  draw();
}

function updateHud() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function showOverlay(title, text, buttonLabel = 'Começar') {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayBtn.textContent = buttonLabel;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  const rotated = rotateMatrix(currentPiece.shape);
  const kickOptions = [0, -1, 1, -2, 2];

  for (const kick of kickOptions) {
    if (!collision(currentPiece.x + kick, currentPiece.y, rotated)) {
      currentPiece.shape = rotated;
      currentPiece.x += kick;
      playRotateSound();
      return;
    }
  }
}

function collision(x, y, shape = currentPiece.shape) {
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (!shape[row][col]) continue;
      const newX = x + col;
      const newY = y + row;
      if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
      if (newY >= 0 && board[newY][newX]) return true;
    }
  }
  return false;
}

function mergePiece() {
  currentPiece.shape.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const x = currentPiece.x + colIndex;
      const y = currentPiece.y + rowIndex;
      if (y >= 0) board[y][x] = currentPiece.color;
    });
  });
}

function clearRows(rowsToClear) {
  const sortedRows = [...new Set(rowsToClear)].filter((row) => row >= 0 && row < ROWS).sort((a, b) => b - a);
  if (sortedRows.length === 0) return 0;

  sortedRows.forEach((row) => {
    board.splice(row, 1);
    board.unshift(Array(COLS).fill(0));
  });

  return sortedRows.length;
}

function spawnPiece() {
  currentPiece = createPiece(nextPiece);
  nextPiece = randomPiece();
  setBonusMode(Boolean(currentPiece.bonus));
  if (currentPiece.bonus) playBonusMusic();
  if (collision(currentPiece.x, currentPiece.y)) {
    gameOver = true;
    triggerGameOverEffect();
    playGameOverSound();
    showOverlay('Fim de jogo', 'Pressione iniciar para tentar outra vez.', 'Jogar de novo');
    draw();
  }
}

function movePiece(dx, dy) {
  if (gameOver || paused) return;
  const newX = currentPiece.x + dx;
  const newY = currentPiece.y + dy;
  if (!collision(newX, newY)) {
    currentPiece.x = newX;
    currentPiece.y = newY;
    if (dx !== 0 || dy !== 0) playMoveSound();
    return true;
  }
  if (dy > 0) {
    lockPiece();
    if (!gameOver) playDropSound();
    draw();
  }
  return false;
}

function hardDrop() {
  if (gameOver || paused) return;
  let distance = 0;
  while (!collision(currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y += 1;
    distance += 1;
  }
  score += distance * 2;
  lockPiece();
  if (!gameOver) playDropSound();
  updateHud();
  draw();
}

function clearLines() {
  const rowsToClear = [];
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row].every(Boolean)) {
      rowsToClear.push(row);
      row += 1;
    }
  }

  const cleared = clearRows(rowsToClear);
  if (cleared > 0) {
    const previousLevel = level;
    lines += cleared;
    score += scoreTable[cleared] * level;
    level = Math.floor(lines / levelStep) + 1;
    dropInterval = Math.max(minDropInterval, 700 - (level - 1) * dropDecay);
    if (level !== previousLevel) bag = [];
    playLineClearSound();
    updateHud();
  }
  return cleared;
}

function clearBonusLines(piece) {
  const rowsToClear = [];
  piece.shape.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const boardRow = piece.y + rowIndex;
      const boardCol = piece.x + colIndex;
      if (boardRow >= 0 && boardRow < ROWS && board[boardRow][boardCol]) {
        rowsToClear.push(boardRow);
      }
    });
  });
  return clearRows(rowsToClear);
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) {
        drawCell(x, y, board[y][x]);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
      }
    }
  }
}

function drawPiece(piece, x, y, context) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  const blockSize = context === ctx ? BLOCK : 35;
  const offsetX = context === ctx ? 0 : 15;
  const offsetY = context === ctx ? 0 : 15;

  piece.shape.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const px = x + colIndex;
      const py = y + rowIndex;
      context.fillStyle = piece.color;
      context.fillRect(px * blockSize + offsetX, py * blockSize + offsetY, blockSize - 2, blockSize - 2);
      context.strokeStyle = 'rgba(255,255,255,0.05)';
      context.strokeRect(px * blockSize + offsetX, py * blockSize + offsetY, blockSize - 2, blockSize - 2);
    });
  });
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = '#04070f';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const previewBlock = 28;
  const width = pieceWidth(nextPiece) * previewBlock;
  const height = pieceHeight(nextPiece) * previewBlock;
  const offsetX = Math.floor((nextCanvas.width - width) / 2);
  const offsetY = Math.floor((nextCanvas.height - height) / 2);

  nextPiece.shape.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const px = offsetX + colIndex * previewBlock;
      const py = offsetY + rowIndex * previewBlock;
      nextCtx.fillStyle = nextPiece.color;
      nextCtx.fillRect(px, py, previewBlock - 2, previewBlock - 2);
      nextCtx.strokeStyle = 'rgba(255,255,255,0.05)';
      nextCtx.strokeRect(px, py, previewBlock - 2, previewBlock - 2);
    });
  });
}

function pieceWidth(piece) {
  return piece.shape[0].length;
}

function pieceHeight(piece) {
  return piece.shape.length;
}

function drawGhost() {
  ctx.save();
  const ghostY = currentPiece.y;
  let y = ghostY;
  while (!collision(currentPiece.x, y + 1)) y += 1;

  currentPiece.shape.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const x = currentPiece.x + colIndex;
      const yy = y + rowIndex;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * BLOCK, yy * BLOCK, BLOCK - 1, BLOCK - 1);
    });
  });
  ctx.restore();
}

function draw() {
  drawBoard();
  if (!gameOver && !paused) drawGhost();
  if (currentPiece) {
    currentPiece.shape.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (!value) return;
        drawCell(currentPiece.x + colIndex, currentPiece.y + rowIndex, currentPiece.color);
      });
    });
  }

  drawNextPiece();
}

function tick(time = 0) {
  if (!lastTime) lastTime = time;
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter >= dropInterval) {
      dropCounter = 0;
      movePiece(0, 1);
    }
  }

  draw();
  requestAnimationFrame(tick);
}

function handleKey(event) {
  const key = event.key.toLowerCase();

  if (key === 'p') {
    togglePause();
    return;
  }
  if (key === 'r') {
    resetGame();
    return;
  }
  if (gameOver || paused) return;

  switch (key) {
    case 'arrowleft':
      movePiece(-1, 0);
      draw();
      break;
    case 'arrowright':
      movePiece(1, 0);
      draw();
      break;
    case 'arrowdown':
      if (movePiece(0, 1)) score += 1;
      updateHud();
      draw();
      break;
    case ' ':
      event.preventDefault();
      rotatePiece();
      draw();
      break;
    case 'enter':
      event.preventDefault();
      hardDrop();
      break;
    case 'x':
      rotatePiece();
      draw();
      break;
    default:
      break;
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (paused) showOverlay('Jogo pausado', 'Aperte P para continuar.', 'Continuar');
  else hideOverlay();
}

function startGame() {
  initAudio();
  resetGame();
  hideOverlay();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  if (!soundEnabled && audioContext) {
    audioContext.close();
    audioContext = null;
    audioReady = false;
  }
  updateSoundButton();
}

function bindTouchControls() {
  document.querySelectorAll('[data-action]').forEach((button) => {
    const runAction = () => {
      const action = button.dataset.action;
      if (action === 'left') movePiece(-1, 0);
      if (action === 'right') movePiece(1, 0);
      if (action === 'down') {
        if (movePiece(0, 1)) score += 1;
      }
      if (action === 'rotate') rotatePiece();
      if (action === 'drop') hardDrop();
      draw();
      updateHud();
    };

    button.addEventListener('touchstart', (event) => {
      event.preventDefault();
      runAction();
    }, { passive: false });

    button.addEventListener('click', runAction);
  });
}

startBtn.addEventListener('click', () => {
  initAudio();
  startGame();
});

pauseBtn.addEventListener('click', () => {
  initAudio();
  togglePause();
});
soundBtn.addEventListener('click', () => {
  toggleSound();
});
overlayBtn.addEventListener('click', () => {
  initAudio();
  if (gameOver) {
    startGame();
  } else if (paused) {
    paused = false;
    hideOverlay();
  } else {
    startGame();
  }
});

document.addEventListener('keydown', handleKey);
document.addEventListener('pointerdown', initAudio, { once: true });

bindTouchControls();

resetGame();
showOverlay('Pronto para jogar?', 'Use as setas do teclado ou os botões abaixo.', 'Começar');
requestAnimationFrame(tick);
