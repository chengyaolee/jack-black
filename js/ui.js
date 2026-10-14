import { createCardElement, getHiLoValue } from './cards.js';
import { getOptimalStrategy, getBettingAdvice, BASIC_STRATEGY } from './strategy.js';
import { sound } from './audio.js';

/**
 * UI Controller
 * Manages DOM updates, card rendering, tooltips, modals, and user input
 */
export class UIController {
  constructor() {
    this.toggles = {
      bettingHints: true,
      strategyHints: true,
      peekCount: false // Default to false (hidden by default)
    };
    this.isPeekMinimized = false;

    // Load saved hint toggles and minimize state
    if (typeof localStorage !== 'undefined') {
      const savedToggles = localStorage.getItem('jb_toggles');
      if (savedToggles) {
        try {
          this.toggles = { ...this.toggles, ...JSON.parse(savedToggles) };
        } catch (e) {}
      }
      const savedMin = localStorage.getItem('jb_peek_minimized');
      if (savedMin !== null) {
        this.isPeekMinimized = savedMin === 'true';
      }
    }

    this.currentMode = 'game'; // 'practice' or 'game'
    this.practiceInputBuffer = '';
    this.practiceSign = 1;
  }

  saveToggles() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jb_toggles', JSON.stringify(this.toggles));
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    const practiceView = document.getElementById('practice-mode-view');
    const gameView = document.getElementById('game-mode-view');
    const tabPractice = document.getElementById('tab-practice');
    const tabGame = document.getElementById('tab-game');

    if (mode === 'practice') {
      practiceView.classList.remove('hidden');
      gameView.classList.add('hidden');
      tabPractice.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white shadow-md transition';
      tabGame.className = 'px-4 py-2 text-sm font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition';
    } else {
      gameView.classList.remove('hidden');
      practiceView.classList.add('hidden');
      tabGame.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white shadow-md transition';
      tabPractice.className = 'px-4 py-2 text-sm font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition';
    }
  }

  // --- Vegas Game Mode Rendering ---

  renderShoeStats(shoeData) {
    if (!shoeData) return;

    // Penetration bar
    const penBar = document.getElementById('shoe-penetration-fill');
    if (penBar) {
      penBar.style.width = `${shoeData.penetration}%`;
      if (shoeData.penetration >= 75) {
        penBar.className = 'h-full bg-rose-500 rounded-full transition-all duration-300';
      } else {
        penBar.className = 'h-full bg-amber-400 rounded-full transition-all duration-300';
      }
    }

    const cardsLeftEl = document.getElementById('shoe-cards-left');
    if (cardsLeftEl) cardsLeftEl.innerText = `${shoeData.cardsLeft} / ${shoeData.totalCards}`;

    const decksLeftEl = document.getElementById('shoe-decks-left');
    if (decksLeftEl) decksLeftEl.innerText = `~${shoeData.decksRemaining} decks`;

    // Peek Drawer content
    const rcEl = document.getElementById('peek-running-count');
    const rcText = shoeData.runningCount > 0 ? `+${shoeData.runningCount}` : `${shoeData.runningCount}`;
    const rcColor = shoeData.runningCount > 0 ? 'text-emerald-400' : (shoeData.runningCount < 0 ? 'text-rose-400' : 'text-slate-200');
    if (rcEl) {
      rcEl.innerText = rcText;
      rcEl.className = `font-mono-numbers text-2xl font-black ${rcColor} my-0.5`;
    }

    const tcEl = document.getElementById('peek-true-count');
    const tcVal = shoeData.trueCount.rounded;
    const tcText = tcVal > 0 ? `+${tcVal}` : `${tcVal}`;
    const tcColor = tcVal > 0 ? 'text-emerald-400' : (tcVal < 0 ? 'text-rose-400' : 'text-slate-200');
    if (tcEl) {
      tcEl.innerText = tcText;
      tcEl.className = `font-mono-numbers text-2xl font-black ${tcColor} my-0.5`;
    }

    const penTextEl = document.getElementById('peek-penetration-text');
    if (penTextEl) penTextEl.innerText = `${shoeData.penetration}% (Cut at 75%)`;

    // Minimized Pill elements
    const miniRcEl = document.getElementById('peek-mini-rc');
    if (miniRcEl) {
      miniRcEl.innerText = `RC: ${rcText}`;
      miniRcEl.className = `font-mono font-black ${rcColor}`;
    }

    const miniTcEl = document.getElementById('peek-mini-tc');
    if (miniTcEl) {
      miniTcEl.innerText = `TC: ${tcText}`;
      miniTcEl.className = `font-mono font-black ${tcColor}`;
    }

    const decksDetailEl = document.getElementById('peek-decks-detail');
    if (decksDetailEl) {
      decksDetailEl.innerText = `Decks: ~${shoeData.decksRemaining}`;
    }
  }

  renderGameTable(gameState, gameEngine) {
    const { dealer, seats, activeSeatIndex, activeHandIndex, shoe } = gameState;
    this.renderShoeStats(shoe);

    // Dealer Area
    const dealerCardsContainer = document.getElementById('dealer-cards');
    if (dealerCardsContainer) {
      dealerCardsContainer.innerHTML = '';
      dealer.cards.forEach((card, idx) => {
        // Dealer card is face down if idx === 1 and faceUp is false
        const cardNode = createCardElement(card, {
          faceUp: card.faceUp,
          theme: 'navy',
          showCountBadge: this.toggles.peekCount && card.faceUp
        });
        dealerCardsContainer.appendChild(cardNode);
      });
    }

    // Dealer Score Badge
    const dealerBadge = document.getElementById('dealer-score-badge');
    if (dealerBadge) {
      if (dealer.cards.length === 0) {
        dealerBadge.classList.add('hidden');
      } else {
        dealerBadge.classList.remove('hidden');
        if (dealer.cards.length >= 2 && !dealer.cards[1].faceUp) {
          // Only show visible upcard value
          const upVal = dealer.cards[0].rank === 'A' ? '11 / 1' : (['10', 'J', 'Q', 'K'].includes(dealer.cards[0].rank) ? '10' : dealer.cards[0].rank);
          dealerBadge.innerText = `Upcard: ${upVal}`;
        } else {
          dealerBadge.innerText = dealer.info.isBust ? `Bust (${dealer.info.total})` : (dealer.info.isBlackjack ? 'Blackjack! 21' : `${dealer.info.total}`);
        }
      }
    }

    // Render Seats
    const seatsContainer = document.getElementById('table-seats');
    if (seatsContainer) {
      seatsContainer.innerHTML = '';
      seats.forEach((seat, seatIdx) => {
        const isCurrentSeat = seatIdx === activeSeatIndex && gameEngine.phase === 'PLAYING';
        const isUser = seat.isUser;

        const seatDiv = document.createElement('div');
        seatDiv.className = `flex flex-col items-center justify-between p-3 rounded-2xl transition-all duration-300 relative ${
          isCurrentSeat 
            ? 'ring-2 ring-amber-400 bg-amber-950/30 scale-105 shadow-xl shadow-amber-500/10' 
            : 'bg-black/30 border border-white/10'
        }`;
        seatDiv.style.minWidth = '160px';

        // Speech bubble / Action badge
        if (seat.speechBubble) {
          const bubble = document.createElement('div');
          bubble.className = 'speech-bubble absolute -top-8 text-amber-300 z-20 whitespace-nowrap animate-bounce';
          bubble.innerText = seat.speechBubble;
          seatDiv.appendChild(bubble);
        }

        // Hands Container (supports split hands)
        const handsContainer = document.createElement('div');
        handsContainer.className = 'flex gap-3 justify-center my-2 min-h-[120px]';

        seat.hands.forEach((hand, hIdx) => {
          const isCurrentHand = isCurrentSeat && hIdx === activeHandIndex;
          const handWrap = document.createElement('div');
          handWrap.className = `flex flex-col items-center p-1.5 rounded-xl transition ${
            isCurrentHand ? 'bg-amber-400/20 ring-1 ring-amber-400' : ''
          }`;

          // Hand Cards
          const cardsRow = document.createElement('div');
          cardsRow.className = 'flex -space-x-10 justify-center';
          hand.cards.forEach(card => {
            const cardEl = createCardElement(card, {
              faceUp: true,
              theme: isUser ? 'navy' : 'burgundy',
              showCountBadge: this.toggles.peekCount
            });
            cardsRow.appendChild(cardEl);
          });
          handWrap.appendChild(cardsRow);

          // Hand Total & Status Badge
          if (hand.cards.length > 0) {
            const statusBadge = document.createElement('div');
            let badgeText = `${hand.info.total}`;
            let badgeBg = 'bg-slate-800 text-slate-200';

            if (hand.status === 'BLACKJACK' || hand.info.isBlackjack) {
              badgeText = 'BJ 21! 🎉';
              badgeBg = 'bg-amber-500 text-slate-950 font-bold';
            } else if (hand.status === 'BUSTED' || hand.info.isBust) {
              badgeText = `Bust ${hand.info.total} 💥`;
              badgeBg = 'bg-rose-600 text-white font-bold';
            } else if (hand.status === 'WON') {
              badgeText = `Won! (${hand.info.total})`;
              badgeBg = 'bg-emerald-600 text-white font-bold';
            } else if (hand.status === 'PUSHED') {
              badgeText = `Push (${hand.info.total})`;
              badgeBg = 'bg-blue-600 text-white';
            } else if (hand.status === 'LOST') {
              badgeText = `Lost (${hand.info.total})`;
              badgeBg = 'bg-slate-700 text-slate-300';
            } else if (hand.info.isSoft && hand.info.total < 21) {
              badgeText = `Soft ${hand.info.total}`;
            }

            statusBadge.className = `mt-1.5 text-xs px-2 py-0.5 rounded-full font-mono font-bold shadow ${badgeBg}`;
            statusBadge.innerText = badgeText;
            handWrap.appendChild(statusBadge);
          }

          // Hand Bet
          const betBadge = document.createElement('div');
          betBadge.className = 'mt-1 text-[11px] font-bold text-amber-300 flex items-center gap-1';
          betBadge.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>$${hand.bet}${hand.doubled ? ' (2x)' : ''}`;
          handWrap.appendChild(betBadge);

          handsContainer.appendChild(handWrap);
        });

        seatDiv.appendChild(handsContainer);

        // Player Info Header
        const playerFooter = document.createElement('div');
        playerFooter.className = 'flex items-center gap-2 mt-2 pt-2 border-t border-white/10 w-full justify-between text-xs';
        playerFooter.innerHTML = `
          <div class="flex items-center gap-1.5 font-bold truncate">
            <span>${seat.avatar}</span>
            <span class="${isUser ? 'text-amber-400 font-extrabold' : 'text-slate-300'} truncate">${seat.name}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="font-mono text-emerald-400 font-bold">$${seat.bankroll}</span>
            ${isUser ? '<button class="btn-reload-bankroll text-[10px] px-1 py-0.2 rounded bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-600/40" title="Reload +$1,000 chips">+</button>' : ''}
          </div>
        `;
        if (isUser) {
          const reloadBtn = playerFooter.querySelector('.btn-reload-bankroll');
          if (reloadBtn) {
            reloadBtn.onclick = (e) => {
              e.stopPropagation();
              gameEngine.rebuyBankroll(1000);
            };
          }
        }
        seatDiv.appendChild(playerFooter);

        seatsContainer.appendChild(seatDiv);
      });
    }

    // Render Controls and Tooltips based on game phase
    this.renderGameControls(gameEngine);
  }

  renderGameControls(gameEngine) {
    const bettingBar = document.getElementById('betting-controls-bar');
    const playingBar = document.getElementById('playing-controls-bar');
    const advisorBanner = document.getElementById('betting-advisor-banner');
    const strategyAdvisor = document.getElementById('strategy-advisor-banner');
    const insuranceModal = document.getElementById('insurance-modal');

    const user = gameEngine.getUserSeat();
    const isUserTurn = gameEngine.phase === 'PLAYING' && gameEngine.activeSeatIndex === gameEngine.userSeatIndex;

    // Betting Phase
    if (gameEngine.phase === 'BETTING') {
      bettingBar.classList.remove('hidden');
      playingBar.classList.add('hidden');
      insuranceModal.classList.add('hidden');

      // Update current bet display
      const currentBetDisplay = document.getElementById('user-current-bet-display');
      if (currentBetDisplay && user) {
        currentBetDisplay.innerText = `$${user.currentBet}`;
      }

      // Update Betting Sizing Advisor
      if (this.toggles.bettingHints) {
        const advice = getBettingAdvice(gameEngine.shoe.getTrueCount(), user.currentBet, gameEngine.minBet, gameEngine.maxBet);
        advisorBanner.classList.remove('hidden');

        const adviceText = document.getElementById('betting-advisor-text');
        const adviceSubText = document.getElementById('betting-advisor-subtext');
        const applyBtn = document.getElementById('btn-apply-recommended-bet');

        if (adviceText) adviceText.innerText = advice.message;
        if (adviceSubText) adviceSubText.innerText = advice.subMessage;

        if (applyBtn) {
          applyBtn.innerText = `Apply $${advice.recommendedBet} Bet`;
          applyBtn.onclick = () => {
            gameEngine.setUserBet(advice.recommendedBet);
            sound.playChipClink();
          };
        }

        // Color coding
        if (advice.status === 'negative') {
          advisorBanner.className = 'p-3 rounded-xl border border-rose-500/40 bg-rose-950/40 flex items-center justify-between gap-4 text-rose-200 text-sm mb-3 shadow-lg';
        } else if (advice.status === 'hot') {
          advisorBanner.className = 'p-3 rounded-xl border border-amber-400 bg-amber-950/50 flex items-center justify-between gap-4 text-amber-200 text-sm mb-3 shadow-lg shadow-amber-500/20';
        } else {
          advisorBanner.className = 'p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 flex items-center justify-between gap-4 text-emerald-200 text-sm mb-3 shadow-lg';
        }
      } else {
        advisorBanner.classList.add('hidden');
      }
    } else {
      bettingBar.classList.add('hidden');
    }

    // Insurance Phase
    if (gameEngine.phase === 'INSURANCE') {
      insuranceModal.classList.remove('hidden');
      const insCost = Math.floor(user.currentBet / 2);
      const insCostSpan = document.getElementById('insurance-cost-display');
      if (insCostSpan) insCostSpan.innerText = `$${insCost}`;

      // Insurance Advice
      const insAdviceEl = document.getElementById('insurance-advisor-text');
      const tc = gameEngine.shoe.getTrueCount();
      if (insAdviceEl) {
        if (tc.floored >= 3) {
          insAdviceEl.innerText = `💡 Strategy Hint: True Count is +${tc.rounded} (≥ +3). Take Insurance!`;
          insAdviceEl.className = 'text-xs text-amber-300 font-bold';
        } else {
          insAdviceEl.innerText = `💡 Strategy Hint: True Count is ${tc.rounded} (< +3). Decline Insurance.`;
          insAdviceEl.className = 'text-xs text-slate-300';
        }
      }
    } else {
      insuranceModal.classList.add('hidden');
    }

    // Playing Phase
    if (gameEngine.phase === 'PLAYING') {
      playingBar.classList.remove('hidden');

      const btnHit = document.getElementById('btn-action-hit');
      const btnStand = document.getElementById('btn-action-stand');
      const btnDouble = document.getElementById('btn-action-double');
      const btnSplit = document.getElementById('btn-action-split');

      // Clear glow highlights
      [btnHit, btnStand, btnDouble, btnSplit].forEach(b => {
        if (b) b.classList.remove('glow-hint-action');
      });

      if (isUserTurn) {
        const userHand = user.hands[gameEngine.activeHandIndex];
        const canDouble = userHand.cards.length === 2 && user.bankroll >= userHand.bet;
        const canSplit = userHand.cards.length === 2 && userHand.info.isPair && user.bankroll >= userHand.bet && user.hands.length < 4;

        if (btnHit) btnHit.disabled = false;
        if (btnStand) btnStand.disabled = false;
        if (btnDouble) btnDouble.disabled = !canDouble;
        if (btnSplit) btnSplit.disabled = !canSplit;

        // Strategy Advisor
        if (this.toggles.strategyHints) {
          const optimal = getOptimalStrategy(userHand.cards, gameEngine.dealer.cards[0], gameEngine.shoe.getTrueCount(), canDouble, canSplit);
          strategyAdvisor.classList.remove('hidden');

          const stratText = document.getElementById('strategy-advisor-text');
          const stratReason = document.getElementById('strategy-advisor-reason');
          if (stratText) stratText.innerText = `Optimal Move: ${optimal.name.toUpperCase()}`;
          if (stratReason) stratReason.innerText = optimal.reason;

          // Highlight recommended action button with pulsing gold glow
          if (optimal.action === 'H' && btnHit) btnHit.classList.add('glow-hint-action');
          if (optimal.action === 'S' && btnStand) btnStand.classList.add('glow-hint-action');
          if (optimal.action === 'D' && btnDouble) btnDouble.classList.add('glow-hint-action');
          if (optimal.action === 'P' && btnSplit) btnSplit.classList.add('glow-hint-action');
        } else {
          strategyAdvisor.classList.add('hidden');
        }
      } else {
        // Disabled while AI or Dealer plays
        if (btnHit) btnHit.disabled = true;
        if (btnStand) btnStand.disabled = true;
        if (btnDouble) btnDouble.disabled = true;
        if (btnSplit) btnSplit.disabled = true;
        strategyAdvisor.classList.add('hidden');
      }
    } else {
      playingBar.classList.add('hidden');
    }

    // Round Over / New Hand button
    const newRoundBar = document.getElementById('round-over-bar');
    if (gameEngine.phase === 'ROUND_OVER') {
      newRoundBar.classList.remove('hidden');
    } else {
      newRoundBar.classList.add('hidden');
    }
  }

  // --- Practice Mode Rendering ---

  renderPracticeCardCluster(clusterCards, index, total) {
    const stage = document.getElementById('practice-card-stage');
    if (!stage) return;

    stage.innerHTML = '';
    const clusterWrap = document.createElement('div');
    clusterWrap.className = 'flex gap-4 justify-center items-center scale-110 md:scale-125';

    clusterCards.forEach(card => {
      const cardEl = createCardElement(card, {
        faceUp: true,
        theme: 'navy',
        showCountBadge: false,
        animate: true
      });
      clusterWrap.appendChild(cardEl);
    });

    stage.appendChild(clusterWrap);

    // Update progress pill
    const progEl = document.getElementById('practice-progress-pill');
    if (progEl) {
      progEl.innerText = `Card ${index + clusterCards.length} of ${total}`;
    }
  }

  showPracticeQuestion(data) {
    const questionModal = document.getElementById('practice-question-modal');
    if (questionModal) {
      questionModal.classList.remove('hidden');
    }
    this.practiceInputBuffer = '0';
    this.practiceSign = 1;
    this.updatePracticeInputDisplay();
  }

  hidePracticeQuestion() {
    const questionModal = document.getElementById('practice-question-modal');
    if (questionModal) {
      questionModal.classList.add('hidden');
    }
  }

  updatePracticeInputDisplay() {
    const displayEl = document.getElementById('practice-input-display');
    if (!displayEl) return;

    const val = parseInt(this.practiceInputBuffer, 10) * this.practiceSign;
    displayEl.innerText = val > 0 ? `+${val}` : `${val}`;
  }

  handlePracticeKey(key, onSubmit) {
    if (key === 'sign') {
      this.practiceSign *= -1;
    } else if (key === 'clear') {
      this.practiceInputBuffer = '0';
      this.practiceSign = 1;
    } else if (key === 'submit') {
      const finalVal = parseInt(this.practiceInputBuffer, 10) * this.practiceSign;
      this.hidePracticeQuestion();
      if (onSubmit) onSubmit(finalVal);
      return;
    } else if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key)) {
      if (this.practiceInputBuffer === '0') {
        this.practiceInputBuffer = key;
      } else if (this.practiceInputBuffer.length < 3) {
        this.practiceInputBuffer += key;
      }
    }
    this.updatePracticeInputDisplay();
  }

  showPracticeRoundFeedback(result, onNextRound) {
    const feedbackModal = document.getElementById('practice-feedback-modal');
    if (!feedbackModal) return;

    feedbackModal.classList.remove('hidden');

    const titleEl = document.getElementById('feedback-title');
    const guessEl = document.getElementById('feedback-user-guess');
    const actualEl = document.getElementById('feedback-actual-count');
    const timeEl = document.getElementById('feedback-time');
    const scoreEl = document.getElementById('feedback-score');
    const mathEl = document.getElementById('feedback-math-breakdown');
    const cardsTray = document.getElementById('feedback-cards-tray');

    if (result.isCorrect) {
      titleEl.innerText = '🎯 PERFECT COUNT!';
      titleEl.className = 'text-2xl font-black text-emerald-400 mb-1';
    } else if (result.diff === 1) {
      titleEl.innerText = '⚠️ CLOSE! OFF BY 1';
      titleEl.className = 'text-2xl font-black text-amber-400 mb-1';
    } else {
      titleEl.innerText = '❌ INCORRECT COUNT';
      titleEl.className = 'text-2xl font-black text-rose-400 mb-1';
    }

    guessEl.innerText = result.userGuess > 0 ? `+${result.userGuess}` : `${result.userGuess}`;
    actualEl.innerText = result.actualCount > 0 ? `+${result.actualCount}` : `${result.actualCount}`;
    timeEl.innerText = `${(result.responseTimeMs / 1000).toFixed(2)}s`;
    scoreEl.innerText = `+${result.points} pts`;

    // Render step-by-step breakdown
    cardsTray.innerHTML = '';
    const mathParts = [];
    let runningCalc = result.priorCount;

    if (result.priorCount !== 0) {
      mathParts.push(`(Prior: ${result.priorCount})`);
    }

    result.cards.forEach(card => {
      // Card visual in tray
      const miniCard = createCardElement(card, {
        faceUp: true,
        theme: 'navy',
        showCountBadge: true,
        animate: false
      });
      miniCard.classList.remove('w-[90px]', 'h-[126px]');
      miniCard.style.width = '56px';
      miniCard.style.height = '80px';
      cardsTray.appendChild(miniCard);

      const hilo = card.hilo;
      runningCalc += hilo;
      mathParts.push(`${card.rank} (${hilo > 0 ? '+' + hilo : hilo})`);
    });

    mathEl.innerText = `${mathParts.join('  +  ')}  =  ${result.actualCount > 0 ? '+' + result.actualCount : result.actualCount}`;

    const nextBtn = document.getElementById('btn-feedback-next-round');
    if (nextBtn) {
      nextBtn.onclick = () => {
        feedbackModal.classList.add('hidden');
        if (onNextRound) onNextRound();
      };
    }
  }

  showPracticeSessionSummary(summary, onPlayAgain, onGoToGame) {
    const summaryModal = document.getElementById('practice-summary-modal');
    if (!summaryModal) return;

    summaryModal.classList.remove('hidden');

    document.getElementById('summary-total-score').innerText = summary.totalScore;
    document.getElementById('summary-accuracy').innerText = `${summary.accuracy}%`;
    document.getElementById('summary-correct-rounds').innerText = `${summary.correctCount} / ${summary.totalRounds}`;
    document.getElementById('summary-avg-speed').innerText = `${(summary.avgResponseTimeMs / 1000).toFixed(2)}s`;

    const rankEl = document.getElementById('summary-rank-title');
    rankEl.innerText = summary.rankTitle;
    rankEl.className = `text-xl font-black ${summary.badgeColor}`;

    document.getElementById('btn-summary-play-again').onclick = () => {
      summaryModal.classList.add('hidden');
      if (onPlayAgain) onPlayAgain();
    };

    document.getElementById('btn-summary-go-game').onclick = () => {
      summaryModal.classList.add('hidden');
      if (onGoToGame) onGoToGame();
    };
  }

  // --- Modals (Strategy Matrix & Card Counting Guide) ---

  initModals() {
    // Strategy Modal
    const btnOpenStrategy = document.getElementById('btn-open-strategy');
    const modalStrategy = document.getElementById('strategy-matrix-modal');
    const btnCloseStrategy = document.getElementById('btn-close-strategy');

    if (btnOpenStrategy && modalStrategy) {
      btnOpenStrategy.onclick = () => {
        this.renderStrategyMatrixContent();
        modalStrategy.classList.remove('hidden');
      };
    }
    if (btnCloseStrategy && modalStrategy) {
      btnCloseStrategy.onclick = () => modalStrategy.classList.add('hidden');
    }

    // Counting Guide Modal
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const modalGuide = document.getElementById('counting-guide-modal');
    const btnCloseGuide = document.getElementById('btn-close-guide');

    if (btnOpenGuide && modalGuide) {
      btnOpenGuide.onclick = () => modalGuide.classList.remove('hidden');
    }
    if (btnCloseGuide && modalGuide) {
      btnCloseGuide.onclick = () => modalGuide.classList.add('hidden');
    }

    // Sound Toggle
    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
      btnSound.onclick = () => {
        const isMuted = sound.toggleMute();
        btnSound.innerHTML = isMuted ? '🔇' : '🔊';
        btnSound.title = isMuted ? 'Sound Muted' : 'Sound Enabled';
      };
      btnSound.innerHTML = sound.isMuted() ? '🔇' : '🔊';
    }

    // 1. Live Peek Drawer Toggle (Top Navbar Button)
    const btnPeek = document.getElementById('btn-toggle-peek');
    if (btnPeek) {
      btnPeek.onclick = (e) => {
        if (e) e.preventDefault();
        this.toggles.peekCount = !this.toggles.peekCount;
        this.saveToggles();
        this.updateToggleButtonsUI();
      };
    }

    // 2. Live Peek Drawer Minimize Button ('−')
    // Minimise will make the window small but keep toggle on!
    const btnMinPeek = document.getElementById('btn-minimize-peek');
    if (btnMinPeek) {
      btnMinPeek.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.isPeekMinimized = true;
        this.toggles.peekCount = true; // KEEP TOGGLE ON!
        this.saveToggles();
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('jb_peek_minimized', 'true');
        }
        this.updateToggleButtonsUI();
      };
    }

    // 3. Live Peek Drawer Close Button ('✕')
    // 'X' will turn off the toggle and the window should not be visible!
    const btnClosePeek = document.getElementById('btn-close-peek');
    if (btnClosePeek) {
      btnClosePeek.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.toggles.peekCount = false; // TURN OFF TOGGLE!
        this.saveToggles();
        this.updateToggleButtonsUI();
      };
    }

    // 4. Minimized Pill Click to Expand (keeps toggle on!)
    const expandFromMini = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.isPeekMinimized = false;
      this.toggles.peekCount = true; // KEEP TOGGLE ON!
      this.saveToggles();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('jb_peek_minimized', 'false');
      }
      this.updateToggleButtonsUI();
    };

    const minContent = document.getElementById('peek-minimized-content');
    if (minContent) {
      minContent.onclick = expandFromMini;
    }

    const btnExpPeek = document.getElementById('btn-expand-peek');
    if (btnExpPeek) {
      btnExpPeek.onclick = expandFromMini;
    }

    // Hint Toggles
    const btnBetHints = document.getElementById('btn-toggle-bet-hints');
    if (btnBetHints) {
      btnBetHints.onclick = () => {
        this.toggles.bettingHints = !this.toggles.bettingHints;
        this.saveToggles();
        this.updateToggleButtonsUI();
      };
    }

    const btnStratHints = document.getElementById('btn-toggle-strat-hints');
    if (btnStratHints) {
      btnStratHints.onclick = () => {
        this.toggles.strategyHints = !this.toggles.strategyHints;
        this.saveToggles();
        this.updateToggleButtonsUI();
      };
    }

    this.updateToggleButtonsUI();
  }

  updateToggleButtonsUI() {
    const btnPeek = document.getElementById('btn-toggle-peek');
    const peekDrawer = document.getElementById('live-count-peek-drawer');

    // 1. Top Navbar button: active if peekCount is true (whether minimized or expanded!)
    if (btnPeek) {
      if (this.toggles.peekCount) {
        btnPeek.className = 'px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 border bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm';
      } else {
        btnPeek.className = 'px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 border bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200';
      }
    }

    // 2. Window visibility and minimized state via deterministic CSS
    if (peekDrawer) {
      if (this.toggles.peekCount) {
        peekDrawer.classList.remove('drawer-closed');
        peekDrawer.classList.add('drawer-open');
        if (this.isPeekMinimized) {
          peekDrawer.classList.add('drawer-minimized');
        } else {
          peekDrawer.classList.remove('drawer-minimized');
        }
      } else {
        peekDrawer.classList.remove('drawer-open');
        peekDrawer.classList.add('drawer-closed');
      }
    }

    const btnBetHints = document.getElementById('btn-toggle-bet-hints');
    if (btnBetHints) {
      btnBetHints.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
        this.toggles.bettingHints 
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500' 
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
      }`;
    }

    const btnStratHints = document.getElementById('btn-toggle-strat-hints');
    if (btnStratHints) {
      btnStratHints.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
        this.toggles.strategyHints 
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500' 
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
      }`;
    }
  }

  renderStrategyMatrixContent() {
    const container = document.getElementById('strategy-matrix-tables');
    if (!container || container.children.length > 0) return; // already rendered

    const dealerHeaders = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

    const actionColors = {
      H: 'bg-emerald-700 text-white',
      S: 'bg-rose-700 text-white',
      D: 'bg-blue-600 text-white',
      Ds: 'bg-blue-600 text-white',
      P: 'bg-amber-600 text-white'
    };

    const actionNames = {
      H: 'H',
      S: 'S',
      D: 'D',
      Ds: 'D',
      P: 'P'
    };

    const createTable = (title, rowData) => {
      let html = `
        <div class="mb-6">
          <h4 class="text-sm font-bold text-amber-400 mb-2 uppercase tracking-wider">${title}</h4>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-center border-collapse">
              <thead>
                <tr class="bg-slate-800 text-slate-400 font-mono">
                  <th class="p-1.5 border border-slate-700 text-left">Your Hand</th>
                  ${dealerHeaders.map(d => `<th class="p-1.5 border border-slate-700 w-8">${d}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
      `;

      for (const [rowLabel, cols] of Object.entries(rowData)) {
        html += `
          <tr>
            <td class="p-1.5 font-bold bg-slate-800/60 border border-slate-700 text-left text-slate-300">${rowLabel}</td>
            ${dealerHeaders.map(d => {
              const act = cols[d] || 'H';
              const colorClass = actionColors[act] || 'bg-slate-700 text-white';
              return `<td class="p-1.5 border border-slate-700 font-mono font-bold ${colorClass}">${actionNames[act] || act}</td>`;
            }).join('')}
          </tr>
        `;
      }

      html += `</tbody></table></div></div>`;
      return html;
    };

    container.innerHTML = `
      <div class="flex gap-4 mb-4 text-xs font-mono font-bold justify-center flex-wrap">
        <span class="px-2 py-1 rounded bg-emerald-700 text-white">H = Hit</span>
        <span class="px-2 py-1 rounded bg-rose-700 text-white">S = Stand</span>
        <span class="px-2 py-1 rounded bg-blue-600 text-white">D = Double Down (Hit if not allowed)</span>
        <span class="px-2 py-1 rounded bg-amber-600 text-white">P = Split Pair</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>${createTable('Hard Totals', BASIC_STRATEGY.hard)}</div>
        <div>${createTable('Soft Totals (Ace + X)', {
          'A,2 (13)': BASIC_STRATEGY.soft[2],
          'A,3 (14)': BASIC_STRATEGY.soft[3],
          'A,4 (15)': BASIC_STRATEGY.soft[4],
          'A,5 (16)': BASIC_STRATEGY.soft[5],
          'A,6 (17)': BASIC_STRATEGY.soft[6],
          'A,7 (18)': BASIC_STRATEGY.soft[7],
          'A,8 (19)': BASIC_STRATEGY.soft[8],
          'A,9 (20)': BASIC_STRATEGY.soft[9]
        })}</div>
        <div>${createTable('Pairs', {
          '2, 2': BASIC_STRATEGY.pairs['2'],
          '3, 3': BASIC_STRATEGY.pairs['3'],
          '4, 4': BASIC_STRATEGY.pairs['4'],
          '5, 5': BASIC_STRATEGY.pairs['5'],
          '6, 6': BASIC_STRATEGY.pairs['6'],
          '7, 7': BASIC_STRATEGY.pairs['7'],
          '8, 8': BASIC_STRATEGY.pairs['8'],
          '9, 9': BASIC_STRATEGY.pairs['9'],
          '10, 10': BASIC_STRATEGY.pairs['10'],
          'A, A': BASIC_STRATEGY.pairs['A']
        })}</div>
      </div>
    `;
  }
}

export const ui = new UIController();
