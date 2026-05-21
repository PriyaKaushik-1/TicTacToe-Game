// Audio System using Web Audio API
class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.theme = 'modern';
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playPlaceX() {
        switch(this.theme) {
            case 'retro': this.playTone(400, 'square', 0.1, 0.05); break;
            case 'acoustic': this.playTone(300, 'sine', 0.15, 0.2); break;
            default: this.playTone(600, 'sine', 0.1, 0.1); break;
        }
    }

    playPlaceO() {
        switch(this.theme) {
            case 'retro': this.playTone(600, 'square', 0.1, 0.05); break;
            case 'acoustic': this.playTone(400, 'triangle', 0.15, 0.2); break;
            default: this.playTone(800, 'sine', 0.1, 0.1); break;
        }
    }

    playWin() {
        if (!this.enabled) return;
        // Simple arpeggio
        setTimeout(() => this.playTone(400, 'sine', 0.2, 0.1), 0);
        setTimeout(() => this.playTone(500, 'sine', 0.2, 0.1), 100);
        setTimeout(() => this.playTone(600, 'sine', 0.4, 0.1), 200);
    }

    playDraw() {
        if (!this.enabled) return;
        setTimeout(() => this.playTone(300, 'sawtooth', 0.2, 0.05), 0);
        setTimeout(() => this.playTone(250, 'sawtooth', 0.3, 0.05), 150);
    }
}

// State & Logic
const app = {
    board: Array(9).fill(null),
    currentPlayer: 'X', // 'X' or 'O'
    gameActive: true,
    mode: 'pvc', // 'pvc' (player vs computer) or 'pvp' (player vs player)
    difficulty: 'hard', // 'easy', 'medium', 'hard'
    scores: { x: 0, o: 0, ties: 0 },
    winningCombinations: [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ],
    audio: new AudioManager(),

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadSettings();
        this.renderBoard();
        this.updateTurnIndicator();
    },

    cacheDOM() {
        this.boardEl = document.getElementById('board');
        this.winLine = document.getElementById('win-line');
        this.cells = [];
        this.scoreX = document.getElementById('score-x');
        this.scoreO = document.getElementById('score-o');
        this.scoreTies = document.getElementById('score-ties');
        this.cardX = document.querySelector('.player-x');
        this.cardO = document.querySelector('.player-o');
        
        // Settings
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = this.settingsModal.querySelector('.close-modal-btn');
        this.themeToggle = document.getElementById('theme-toggle');
        this.soundToggle = document.getElementById('sound-toggle');
        this.soundTheme = document.getElementById('sound-theme');
        this.colorX = document.getElementById('color-x');
        this.colorO = document.getElementById('color-o');
        
        // Mode & Controls
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.difficultySelect = document.getElementById('difficulty-select');
        this.difficultyWrapper = document.getElementById('difficulty-wrapper');
        this.resetBtn = document.getElementById('reset-game-btn');
        
        // Game Over
        this.gameOverModal = document.getElementById('game-over-modal');
        this.gameOverMsg = document.getElementById('game-over-message');
        this.playAgainBtn = document.getElementById('play-again-btn');
    },

    bindEvents() {
        document.addEventListener('click', () => {
            if (this.audio.ctx.state === 'suspended') {
                this.audio.ctx.resume();
            }
        }, { once: true });

        this.settingsBtn.addEventListener('click', () => this.toggleModal(this.settingsModal, true));
        this.closeSettingsBtn.addEventListener('click', () => this.toggleModal(this.settingsModal, false));
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.toggleModal(this.settingsModal, false);
        });

        this.themeToggle.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
            this.saveSettings();
        });

        this.soundToggle.addEventListener('change', (e) => {
            this.audio.enabled = e.target.checked;
            this.saveSettings();
        });

        this.soundTheme.addEventListener('change', (e) => {
            this.audio.theme = e.target.value;
            this.saveSettings();
        });

        this.colorX.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--color-x', e.target.value);
            this.saveSettings();
        });

        this.colorO.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--color-o', e.target.value);
            this.saveSettings();
        });

        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.modeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
                
                if (this.mode === 'pvc') {
                    this.difficultyWrapper.classList.remove('disabled');
                } else {
                    this.difficultyWrapper.classList.add('disabled');
                }
                
                this.resetGame();
            });
        });

        this.difficultySelect.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this.resetGame();
        });

        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.playAgainBtn.addEventListener('click', () => {
            this.toggleModal(this.gameOverModal, false);
            this.resetGame();
        });
    },

    loadSettings() {
        const saved = JSON.parse(localStorage.getItem('ticTacToeSettings'));
        if (saved) {
            this.themeToggle.checked = saved.theme === 'dark';
            document.documentElement.setAttribute('data-theme', saved.theme);
            
            this.soundToggle.checked = saved.soundEnabled;
            this.audio.enabled = saved.soundEnabled;
            
            this.soundTheme.value = saved.soundTheme;
            this.audio.theme = saved.soundTheme;
            
            this.colorX.value = saved.colorX;
            document.documentElement.style.setProperty('--color-x', saved.colorX);
            
            this.colorO.value = saved.colorO;
            document.documentElement.style.setProperty('--color-o', saved.colorO);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.themeToggle.checked = prefersDark;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
    },

    saveSettings() {
        const settings = {
            theme: this.themeToggle.checked ? 'dark' : 'light',
            soundEnabled: this.soundToggle.checked,
            soundTheme: this.soundTheme.value,
            colorX: this.colorX.value,
            colorO: this.colorO.value
        };
        localStorage.setItem('ticTacToeSettings', JSON.stringify(settings));
    },

    toggleModal(modal, show) {
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    renderBoard() {
        this.boardEl.innerHTML = '';
        this.cells = [];
        this.board.forEach((val, index) => {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = index;
            cell.addEventListener('click', () => this.handleCellClick(index));
            this.boardEl.appendChild(cell);
            this.cells.push(cell);
        });
    },

    updateBoardUI() {
        this.board.forEach((val, index) => {
            const cell = this.cells[index];
            if (val && !cell.classList.contains('filled')) {
                cell.textContent = val;
                cell.classList.add('filled', val.toLowerCase());
            }
        });
    },

    handleCellClick(index) {
        if (!this.gameActive || this.board[index]) return;
        if (this.mode === 'pvc' && this.currentPlayer === 'O') return; // Wait for AI

        this.makeMove(index, this.currentPlayer);

        if (this.gameActive && this.mode === 'pvc' && this.currentPlayer === 'O') {
            setTimeout(() => this.makeAIMove(), 500); // Slight delay for realism
        }
    },

    makeMove(index, player) {
        this.board[index] = player;
        this.updateBoardUI();
        
        if (player === 'X') this.audio.playPlaceX();
        else this.audio.playPlaceO();

        if (this.checkWin(player)) {
            this.endGame(player);
        } else if (this.checkDraw()) {
            this.endGame('Draw');
        } else {
            this.currentPlayer = player === 'X' ? 'O' : 'X';
            this.updateTurnIndicator();
        }
    },

    makeAIMove() {
        if (!this.gameActive) return;
        
        let moveIndex;
        if (this.difficulty === 'easy') {
            moveIndex = this.getRandomMove();
        } else if (this.difficulty === 'medium') {
            // 50% random, 50% best move
            moveIndex = Math.random() > 0.5 ? this.getBestMove() : this.getRandomMove();
        } else {
            moveIndex = this.getBestMove();
        }

        if (moveIndex !== null) {
            this.makeMove(moveIndex, 'O');
        }
    },

    getRandomMove() {
        const emptyIndices = this.board.map((v, i) => v === null ? i : null).filter(v => v !== null);
        if (emptyIndices.length === 0) return null;
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    },

    getBestMove() {
        let bestScore = -Infinity;
        let move = null;
        for (let i = 0; i < this.board.length; i++) {
            if (this.board[i] === null) {
                this.board[i] = 'O';
                let score = this.minimax(this.board, 0, false);
                this.board[i] = null;
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    },

    minimax(board, depth, isMaximizing) {
        if (this.checkWinCondition(board, 'O')) return 10 - depth;
        if (this.checkWinCondition(board, 'X')) return depth - 10;
        if (!board.includes(null)) return 0;

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === null) {
                    board[i] = 'O';
                    let score = this.minimax(board, depth + 1, false);
                    board[i] = null;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === null) {
                    board[i] = 'X';
                    let score = this.minimax(board, depth + 1, true);
                    board[i] = null;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    },

    checkWinCondition(board, player) {
        return this.winningCombinations.some(comb => {
            return comb.every(index => board[index] === player);
        });
    },

    checkWin(player) {
        const winningCombo = this.winningCombinations.find(comb => {
            return comb.every(index => this.board[index] === player);
        });

        if (winningCombo) {
            winningCombo.forEach(index => {
                this.cells[index].classList.add('winner');
            });
            this.drawWinLine(winningCombo, player);
            return true;
        }
        return false;
    },

    drawWinLine(combo, player) {
        const cell1 = this.cells[combo[0]];
        const cell3 = this.cells[combo[2]];
        const boardRect = this.boardEl.getBoundingClientRect();
        const rect1 = cell1.getBoundingClientRect();
        const rect3 = cell3.getBoundingClientRect();
        
        const x1 = rect1.left + rect1.width / 2 - boardRect.left;
        const y1 = rect1.top + rect1.height / 2 - boardRect.top;
        
        const x2 = rect3.left + rect3.width / 2 - boardRect.left;
        const y2 = rect3.top + rect3.height / 2 - boardRect.top;
        
        const length = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
        
        this.winLine.style.width = `${length}px`;
        this.winLine.style.height = '8px';
        this.winLine.style.left = `${x1}px`;
        this.winLine.style.top = `${y1}px`;
        this.winLine.style.transform = `translateY(-50%) rotate(${angle}deg)`;
        this.winLine.style.opacity = '1';
        this.winLine.style.background = player === 'X' ? 'var(--color-x)' : 'var(--color-o)';
    },

    checkDraw() {
        return !this.board.includes(null);
    },

    updateTurnIndicator() {
        if (this.currentPlayer === 'X') {
            this.cardX.classList.add('active-turn');
            this.cardO.classList.remove('active-turn');
        } else {
            this.cardO.classList.add('active-turn');
            this.cardX.classList.remove('active-turn');
        }
    },

    endGame(winner) {
        this.gameActive = false;
        
        if (winner === 'Draw') {
            this.scores.ties++;
            this.scoreTies.textContent = this.scores.ties;
            this.gameOverMsg.textContent = "It's a Tie!";
            this.audio.playDraw();
        } else {
            if (winner === 'X') {
                this.scores.x++;
                this.scoreX.textContent = this.scores.x;
                this.gameOverMsg.textContent = "Player X Wins!";
            } else {
                this.scores.o++;
                this.scoreO.textContent = this.scores.o;
                this.gameOverMsg.textContent = "Player O Wins!";
            }
            this.audio.playWin();
        }

        setTimeout(() => this.toggleModal(this.gameOverModal, true), 1000);
    },

    resetGame() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.winLine.style.opacity = '0';
        
        this.cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('filled', 'x', 'o', 'winner');
        });
        
        this.updateTurnIndicator();
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
