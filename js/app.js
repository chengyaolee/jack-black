import { BlackjackGame } from './game.js';
import { PracticeEngine } from './practice.js';
import { MultiplayerEngine } from './multiplayer.js';
import { ui } from './ui.js';
import { sound } from './audio.js';

/**
 * Main Application Orchestrator
 */
class App {
  constructor() {
    this.game = null;
    this.practice = null;
    this.multiplayer = null;
    this.lastGameState = null;
  }

  init() {
    ui.initModals();

    // 1. Initialize Blackjack Game Engine
    this.game = new BlackjackGame({
      tableSeatsCount: 3,
      userSeatIndex: 1, // center seat in 3-seat table
      aiDelta: 0.0,
      onStateChange: (phase, data) => {
        this.lastGameState = data;
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

    // 3. Initialize Multiplayer Engine (WebRTC P2P)
    this.multiplayer = new MultiplayerEngine({
      onStatusChange: (status) => {
        ui.updateMultiplayerStatus(status);
        if (status.status === 'HOSTING') {
          this.showToastNotification(`Room created! Code: ${status.roomCode}`, 'info');
        } else if (status.status === 'CONNECTED_AS_GUEST') {
          this.showToastNotification(`Joined Room ${status.roomCode}!`, 'info');
        } else if (status.status === 'SOLO') {
          this.showToastNotification('Switched to Solo play', 'info');
        }
      },
      onRemoteAction: ({ peerId, action }) => {
        if (this.multiplayer.isHost()) {
          this.game.handleRemoteAction(peerId, action);
        }
      },
      onRemoteBet: ({ peerId, amount }) => {
        if (this.multiplayer.isHost()) {
          this.game.handleRemoteBet(peerId, amount);
        }
      },
      onRemoteInsurance: ({ peerId, take }) => {
        if (this.multiplayer.isHost()) {
          this.game.handleRemoteInsurance(peerId, take);
        }
      },
      onPlayerJoined: ({ peerId, name, avatar }) => {
        if (this.multiplayer.isHost()) {
          const seatIdx = this.game.assignPlayerToSeat(peerId, name, avatar);
          if (seatIdx !== -1) {
            this.showToastNotification(`${avatar} ${name} joined table!`, 'info');
            // Send WELCOME packet to client with their seat index and initial state
            this.multiplayer.sendToClient(peerId, {
              type: 'WELCOME',
              seatIndex: seatIdx,
              tableName: 'Vegas 6-Deck Table',
              initialState: {
                dealer: this.game.dealer,
                seats: this.game.seats,
                activeSeatIndex: this.game.activeSeatIndex,
                activeHandIndex: this.game.activeHandIndex,
                phase: this.game.phase,
                shoe: {
                  cardsLeft: this.game.shoe.getCardsRemaining(),
                  totalCards: this.game.shoe.getTotalCards(),
                  runningCount: this.game.shoe.runningCount,
                  decksRemaining: this.game.shoe.getDecksRemaining(),
                  trueCount: this.game.shoe.getTrueCount(),
                  penetration: this.game.shoe.getPenetrationPercentage(),
                  cutCardReached: this.game.shoe.needsReshuffle
                }
              }
            });
            ui.updateMultiplayerStatus({
              role: 'HOST',
              roomCode: this.multiplayer.roomCode,
              connectedPeers: this.multiplayer.clientConnections.size
            });
          } else {
            this.multiplayer.sendToClient(peerId, { type: 'ROOM_FULL' });
          }
        }
      },
      onPlayerLeft: ({ peerId }) => {
        if (this.multiplayer.isHost()) {
          this.game.removePlayerFromSeat(peerId);
          this.showToastNotification('A player left the table', 'warning');
          ui.updateMultiplayerStatus({
            role: 'HOST',
            roomCode: this.multiplayer.roomCode,
            connectedPeers: this.multiplayer.clientConnections.size
          });
        }
      },
      onStateSync: (state, assignedSeatIndex) => {
        if (this.multiplayer.isClient()) {
          this.lastGameState = state;
          this.game.phase = state.phase;
          this.game.dealer = state.dealer;
          this.game.seats = state.seats;
          this.game.activeSeatIndex = state.activeSeatIndex;
          this.game.activeHandIndex = state.activeHandIndex;
          this.game.shoe.runningCount = state.shoe.runningCount;
          ui.renderGameTable(state, this.game);
        }
      },
      onReaction: ({ peerId, emoji }) => {
        let seatIdx = 0;
        if (peerId === 'host') {
          seatIdx = 0;
        } else {
          const seat = this.game.seats.find(s => s.peerId === peerId);
          seatIdx = seat ? seat.index : 0;
        }
        ui.showFloatingReaction(seatIdx, emoji);
      },
      onError: (errMsg) => {
        this.showToastNotification(errMsg, 'warning');
      }
    });

    this.game.multiplayer = this.multiplayer;

    // Connect game broadcast to multiplayer host
    this.game.onBroadcast = (state) => {
      if (this.multiplayer.isHost()) {
        this.multiplayer.broadcastState(state);
      }
    };

    // Wire Multiplayer UI Modals
    ui.initMultiplayerModals({
      onHostStart: (name, avatar) => {
        this.multiplayer.startHosting(null, name, avatar);
      },
      onJoin: (roomCode, name, avatar) => {
        this.multiplayer.joinRoom(roomCode, name, avatar);
      },
      onDisconnect: () => {
        this.multiplayer.disconnect();
        ui.renderGameTable(this.lastGameState || this.game, this.game);
      },
      onSendReaction: (emoji) => {
        this.multiplayer.sendReaction(emoji);
        const mySeat = this.multiplayer.isClient() ? this.multiplayer.assignedSeatIndex : 0;
        ui.showFloatingReaction(mySeat, emoji);
      }
    });

    this.bindDOMEvents();
    this.bindKeyboardShortcuts();

    // Check URL query parameters for direct invite link: ?room=CODE
    this.checkUrlForRoomCode();

    // Initial render
    ui.setMode('game');
    this.game.notifyUpdate();
  }

  checkUrlForRoomCode() {
    try {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room) {
        ui.showMultiplayerModal();
        ui.setMultiplayerTab('join');
        const codeInput = document.getElementById('mp-input-room-code');
        if (codeInput) {
          codeInput.value = room.toUpperCase();
        }
      }
    } catch (e) {}
  }

  bindDOMEvents() {
    // Mode Switcher Tabs
    document.getElementById('tab-game').onclick = () => ui.setMode('game');
    document.getElementById('tab-practice').onclick = () => {
      ui.setMode('practice');
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
        if (this.multiplayer.isClient()) {
          this.showToastNotification('Seat count is managed by the host in multiplayer', 'info');
          return;
        }
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
        if (this.multiplayer.isClient()) {
          const seat = this.game.seats[this.multiplayer.assignedSeatIndex];
          if (seat && this.game.phase === 'BETTING') {
            const newBet = Math.min(seat.bankroll, Math.min(this.game.maxBet, seat.currentBet + val));
            seat.currentBet = newBet;
            if (seat.hands[0]) seat.hands[0].bet = newBet;
            this.multiplayer.sendBet(newBet);
            sound.playChipClink();
            const curBetDisplay = document.getElementById('user-current-bet-display');
            if (curBetDisplay) curBetDisplay.innerText = `$${newBet}`;
          }
        } else {
          this.game.addUserChip(val);
        }
      };
    });

    // Bet controls
    document.getElementById('btn-clear-bet').onclick = () => {
      if (this.multiplayer.isClient()) {
        const seat = this.game.seats[this.multiplayer.assignedSeatIndex];
        if (seat && this.game.phase === 'BETTING') {
          seat.currentBet = this.game.minBet;
          if (seat.hands[0]) seat.hands[0].bet = this.game.minBet;
          this.multiplayer.sendBet(this.game.minBet);
          sound.playChipClink();
          const curBetDisplay = document.getElementById('user-current-bet-display');
          if (curBetDisplay) curBetDisplay.innerText = `$${this.game.minBet}`;
        }
      } else {
        this.game.clearUserBet();
      }
    };

    document.getElementById('btn-double-bet').onclick = () => {
      if (this.multiplayer.isClient()) {
        const seat = this.game.seats[this.multiplayer.assignedSeatIndex];
        if (seat && this.game.phase === 'BETTING') {
          const newBet = Math.min(seat.bankroll, Math.min(this.game.maxBet, seat.currentBet * 2));
          seat.currentBet = newBet;
          if (seat.hands[0]) seat.hands[0].bet = newBet;
          this.multiplayer.sendBet(newBet);
          sound.playChipClink();
          const curBetDisplay = document.getElementById('user-current-bet-display');
          if (curBetDisplay) curBetDisplay.innerText = `$${newBet}`;
        }
      } else {
        const user = this.game.getUserSeat();
        if (user) this.game.setUserBet(user.currentBet * 2);
      }
    };

    // Deal Button
    const btnDeal = document.getElementById('btn-deal-cards');
    if (btnDeal) {
      btnDeal.onclick = () => {
        if (this.multiplayer.isClient()) {
          this.showToastNotification('The Host deals the cards for the table', 'info');
          return;
        }
        this.game.startDeal();
      };
    }

    // Action buttons
    document.getElementById('btn-action-hit').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.multiplayer.sendAction('HIT');
      } else {
        this.game.userHit();
      }
    };
    document.getElementById('btn-action-stand').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.multiplayer.sendAction('STAND');
      } else {
        this.game.userStand();
      }
    };
    document.getElementById('btn-action-double').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.multiplayer.sendAction('DOUBLE');
      } else {
        this.game.userDouble();
      }
    };
    document.getElementById('btn-action-split').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.multiplayer.sendAction('SPLIT');
      } else {
        this.game.userSplit();
      }
    };

    // Insurance Modal buttons
    document.getElementById('btn-insurance-yes').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.multiplayer.sendInsurance(true);
        document.getElementById('insurance-modal')?.classList.add('hidden');
      } else {
        this.game.resolveInsuranceDecision(true);
      }
    };
    document.getElementById('btn-insurance-no').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.multiplayer.sendInsurance(false);
        document.getElementById('insurance-modal')?.classList.add('hidden');
      } else {
        this.game.resolveInsuranceDecision(false);
      }
    };

    // Round Over / New Hand button
    document.getElementById('btn-new-round').onclick = () => {
      if (this.multiplayer.isClient()) {
        this.showToastNotification('Waiting for host to start the next hand', 'info');
        return;
      }
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
            if (!this.multiplayer.isClient()) {
              this.game.startDeal();
            }
          }
        } else if (this.game.phase === 'PLAYING') {
          if (key === 'H') {
            if (this.multiplayer.isClient()) this.multiplayer.sendAction('HIT');
            else this.game.userHit();
          } else if (key === 'S' || e.key === ' ') {
            e.preventDefault();
            if (this.multiplayer.isClient()) this.multiplayer.sendAction('STAND');
            else this.game.userStand();
          } else if (key === 'D') {
            if (this.multiplayer.isClient()) this.multiplayer.sendAction('DOUBLE');
            else this.game.userDouble();
          } else if (key === 'P') {
            if (this.multiplayer.isClient()) this.multiplayer.sendAction('SPLIT');
            else this.game.userSplit();
          }
        } else if (this.game.phase === 'ROUND_OVER') {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!this.multiplayer.isClient()) {
              this.game.readyNextBettingPhase();
            }
          }
        }
      } else if (ui.currentMode === 'practice') {
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
function startApp() {
  const app = new App();
  app.init();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
