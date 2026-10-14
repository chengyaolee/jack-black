import { BlackjackGame } from './game.js';
import { PracticeEngine } from './practice.js';
import { ui } from './ui.js';
import { sound } from './audio.js';

/**
 * Main Application Orchestrator
 */
class App {
  constructor() {
    this.game = null;
    this.practice = null;
  }

  init() {
    ui.initModals();

    // 1. Initialize Blackjack Game Engine
    this.game = new BlackjackGame({
      tableSeatsCount: 3,
      userSeatIndex: 1, // center seat in 3-seat table
      aiDelta: 0.0,
      onStateChange: (phase, data) => {
        ui.renderGameTable(data, this.game);
      },
      onMessage: (msg) => {
        this.showToastNotification(msg.text, msg.type);
      }
    });

    // 2. Initialize Practice Mode Engine
    this.practice = new PracticeEngine({
      speed: 1000,
      cardsPerRound: 10,
      totalRounds: 5,
      displayStyle: 'single',
      continuousShoe: false,
      onCardDealt: (data) => {
        ui.renderPracticeCardCluster(data.clusterCards, data.roundIndex, data.totalThisRound);
      },
      onStateChange: (state, data) => {
        if (state === 'AWAITING_INPUT') {
          ui.showPracticeQuestion(data);
        } else if (state === 'FEEDBACK') {
          ui.showPracticeRoundFeedback(data, () => {
            this.practice.startNextRound();
          });
        } else if (state === 'SESSION_SUMMARY') {
          ui.showPracticeSessionSummary(
            data,
            () => this.practice.startSession(),
            () => ui.setMode('game')
          );
        }
      }
    });

    this.bindDOMEvents();
    this.bindKeyboardShortcuts();

    // Initial render
    ui.setMode('game');
    this.game.notifyUpdate();
  }

  bindDOMEvents() {
    // Mode Switcher Tabs
    document.getElementById('tab-game').onclick = () => ui.setMode('game');
    document.getElementById('tab-practice').onclick = () => {
      ui.setMode('practice');
      // If practice idle, show prompt to start
    };

    // AI Delta Slider
    const deltaSlider = document.getElementById('slider-ai-delta');
    const deltaLabel = document.getElementById('label-ai-delta');
    const deltaDesc = document.getElementById('desc-ai-delta');

    const updateDeltaUI = (val) => {
      const num = parseFloat(val);
      this.game.setAiDelta(num);
      if (deltaLabel) deltaLabel.innerText = `Δ = ${num.toFixed(2)}`;
      if (deltaDesc) {
        if (num === 0.0) deltaDesc.innerText = 'GTO Basic Strategy Master (Optimal)';
        else if (num <= 0.3) deltaDesc.innerText = 'Sharp Casual Gambler';
        else if (num <= 0.6) deltaDesc.innerText = 'Unpredictable Player';
        else if (num <= 0.9) deltaDesc.innerText = 'Wild Vegas Tourist';
        else deltaDesc.innerText = 'Pure Casino Chaos 🤪';
      }
    };

    if (deltaSlider) {
      deltaSlider.oninput = (e) => updateDeltaUI(e.target.value);
      updateDeltaUI(deltaSlider.value);
    }

    // Seats Count Selector
    const seatButtons = document.querySelectorAll('.btn-seat-count');
    seatButtons.forEach(btn => {
      btn.onclick = () => {
        const count = parseInt(btn.dataset.seats, 10);
        seatButtons.forEach(b => b.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold'));
        btn.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
        this.game.setSeatCount(count);
      };
    });

    // Chip buttons
    const chipBtns = document.querySelectorAll('.casino-chip');
    chipBtns.forEach(btn => {
      btn.onclick = () => {
        const val = parseInt(btn.dataset.value, 10);
        this.game.addUserChip(val);
      };
    });

    // Bet controls
    document.getElementById('btn-clear-bet').onclick = () => this.game.clearUserBet();
    document.getElementById('btn-double-bet').onclick = () => {
      const user = this.game.getUserSeat();
      if (user) this.game.setUserBet(user.currentBet * 2);
    };

    // Deal Button
    const btnDeal = document.getElementById('btn-deal-cards');
    if (btnDeal) {
      btnDeal.onclick = () => this.game.startDeal();
    }

    // Action buttons
    document.getElementById('btn-action-hit').onclick = () => this.game.userHit();
    document.getElementById('btn-action-stand').onclick = () => this.game.userStand();
    document.getElementById('btn-action-double').onclick = () => this.game.userDouble();
    document.getElementById('btn-action-split').onclick = () => this.game.userSplit();

    // Insurance Modal buttons
    document.getElementById('btn-insurance-yes').onclick = () => {
      this.game.resolveInsuranceDecision(true);
    };
    document.getElementById('btn-insurance-no').onclick = () => {
      this.game.resolveInsuranceDecision(false);
    };

    // Round Over / New Hand button
    document.getElementById('btn-new-round').onclick = () => {
      this.game.readyNextBettingPhase();
    };

    // --- Practice Mode Controls ---
    const btnStartPractice = document.getElementById('btn-start-practice');
    if (btnStartPractice) {
      btnStartPractice.onclick = () => {
        this.applyPracticeSettingsFromDOM();
        this.practice.startSession();
      };
    }

    // Practice Speed Presets
    const speedPresets = document.querySelectorAll('.btn-speed-preset');
    const speedSlider = document.getElementById('practice-speed-slider');
    const speedLabel = document.getElementById('practice-speed-label');

    const setSpeedMs = (ms) => {
      if (speedSlider) speedSlider.value = ms;
      if (speedLabel) speedLabel.innerText = `${(ms / 1000).toFixed(2)}s / card`;
      this.practice.setOptions({ speed: parseInt(ms, 10) });
    };

    speedPresets.forEach(btn => {
      btn.onclick = () => {
        speedPresets.forEach(b => b.classList.remove('bg-emerald-600', 'text-white'));
        btn.classList.add('bg-emerald-600', 'text-white');
        setSpeedMs(btn.dataset.speed);
      };
    });

    if (speedSlider) {
      speedSlider.oninput = (e) => {
        speedPresets.forEach(b => b.classList.remove('bg-emerald-600', 'text-white'));
        setSpeedMs(e.target.value);
      };
    }

    // Practice Display Style (Single, Pair, Triple)
    const styleBtns = document.querySelectorAll('.btn-display-style');
    styleBtns.forEach(btn => {
      btn.onclick = () => {
        styleBtns.forEach(b => b.classList.remove('bg-emerald-600', 'text-white'));
        btn.classList.add('bg-emerald-600', 'text-white');
        this.practice.setOptions({ displayStyle: btn.dataset.style });
      };
    });

    // Cards per round
    const cardsPerRoundSelect = document.getElementById('select-cards-per-round');
    if (cardsPerRoundSelect) {
      cardsPerRoundSelect.onchange = (e) => {
        this.practice.setOptions({ cardsPerRound: parseInt(e.target.value, 10) });
      };
    }

    // Practice Numpad Buttons
    const numpadKeys = document.querySelectorAll('.practice-key');
    numpadKeys.forEach(keyBtn => {
      keyBtn.onclick = () => {
        const key = keyBtn.dataset.key;
        ui.handlePracticeKey(key, (guess) => {
          this.practice.submitUserGuess(guess);
        });
      };
    });
  }

  applyPracticeSettingsFromDOM() {
    const speedSlider = document.getElementById('practice-speed-slider');
    const cardsSelect = document.getElementById('select-cards-per-round');
    const continuousToggle = document.getElementById('practice-continuous-toggle');

    this.practice.setOptions({
      speed: speedSlider ? parseInt(speedSlider.value, 10) : 1000,
      cardsPerRound: cardsSelect ? parseInt(cardsSelect.value, 10) : 10,
      continuousShoe: continuousToggle ? continuousToggle.checked : false
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (ui.currentMode === 'game') {
        const key = e.key.toUpperCase();
        if (this.game.phase === 'BETTING') {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.game.startDeal();
          }
        } else if (this.game.phase === 'PLAYING') {
          if (key === 'H') {
            this.game.userHit();
          } else if (key === 'S' || e.key === ' ') {
            e.preventDefault();
            this.game.userStand();
          } else if (key === 'D') {
            this.game.userDouble();
          } else if (key === 'P') {
            this.game.userSplit();
          }
        } else if (this.game.phase === 'ROUND_OVER') {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.game.readyNextBettingPhase();
          }
        }
      } else if (ui.currentMode === 'practice') {
        // Practice numpad keyboard handling
        const questionModal = document.getElementById('practice-question-modal');
        if (questionModal && !questionModal.classList.contains('hidden')) {
          if (e.key >= '0' && e.key <= '9') {
            ui.handlePracticeKey(e.key, (guess) => this.practice.submitUserGuess(guess));
          } else if (e.key === '-' || e.key === '+') {
            ui.handlePracticeKey('sign', (guess) => this.practice.submitUserGuess(guess));
          } else if (e.key === 'Backspace' || e.key === 'Escape') {
            ui.handlePracticeKey('clear', (guess) => this.practice.submitUserGuess(guess));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            ui.handlePracticeKey('submit', (guess) => this.practice.submitUserGuess(guess));
          }
        }
      }
    });
  }

  showToastNotification(text, type = 'info') {
    const toast = document.createElement('div');
    const colorClass = type === 'warning' ? 'bg-amber-600' : 'bg-slate-800 border border-slate-600';
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl text-white text-sm font-semibold z-50 flex items-center gap-2 animate-bounce ${colorClass}`;
    toast.innerText = text;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
