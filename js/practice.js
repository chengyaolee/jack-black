import { Shoe } from './shoe.js';
import { sound } from './audio.js';
import { getHiLoValue } from './cards.js';

/**
 * Speed Counting Practice Mode (Flashcard Drill)
 * Trains rapid visual pattern recognition and mental Hi-Lo arithmetic under time pressure.
 */
export class PracticeEngine {
  constructor(options = {}) {
    this.speed = options.speed || 1000; // ms per card
    this.cardsPerRound = options.cardsPerRound || 10;
    this.totalRounds = options.totalRounds || 5;
    this.displayStyle = options.displayStyle || 'single'; // 'single', 'pair', 'triple'
    this.continuousShoe = options.continuousShoe || false;

    this.shoe = new Shoe(6);
    this.currentRound = 0;
    this.state = 'IDLE'; // 'IDLE', 'DEALING', 'AWAITING_INPUT', 'FEEDBACK', 'SESSION_SUMMARY'
    
    this.roundCards = [];
    this.expectedCount = 0;
    this.priorCount = 0;
    
    this.sessionHistory = [];
    this.dealTimer = null;
    this.questionStartTime = 0;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onCardDealt = options.onCardDealt || (() => {});
    this.onRoundFinished = options.onRoundFinished || (() => {});
    this.onSessionSummary = options.onSessionSummary || (() => {});
  }

  setOptions(opts) {
    if (opts.speed !== undefined) this.speed = opts.speed;
    if (opts.cardsPerRound !== undefined) this.cardsPerRound = opts.cardsPerRound;
    if (opts.totalRounds !== undefined) this.totalRounds = opts.totalRounds;
    if (opts.displayStyle !== undefined) this.displayStyle = opts.displayStyle;
    if (opts.continuousShoe !== undefined) this.continuousShoe = opts.continuousShoe;
  }

  startSession() {
    this.stop();
    this.shoe = new Shoe(6);
    this.currentRound = 0;
    this.sessionHistory = [];
    this.priorCount = 0;
    this.startNextRound();
  }

  startNextRound() {
    if (this.currentRound >= this.totalRounds) {
      this.finishSession();
      return;
    }

    this.currentRound++;
    this.roundCards = [];
    
    if (!this.continuousShoe) {
      this.priorCount = 0;
      this.expectedCount = 0;
    } else {
      this.priorCount = this.shoe.runningCount;
      this.expectedCount = this.shoe.runningCount;
    }

    this.state = 'DEALING';
    this.onStateChange(this.state, {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      cardsPerRound: this.cardsPerRound
    });

    this.dealBatchStep(0);
  }

  dealBatchStep(dealtSoFar) {
    if (dealtSoFar >= this.cardsPerRound) {
      // Finished dealing this round's cards; prompt user for count
      this.state = 'AWAITING_INPUT';
      this.questionStartTime = performance.now();
      this.onStateChange(this.state, {
        round: this.currentRound,
        expectedCount: this.expectedCount,
        priorCount: this.priorCount,
        roundCards: this.roundCards
      });
      return;
    }

    // Determine cluster size
    let clusterCount = 1;
    if (this.displayStyle === 'pair') clusterCount = 2;
    if (this.displayStyle === 'triple') clusterCount = 3;
    clusterCount = Math.min(clusterCount, this.cardsPerRound - dealtSoFar);

    const clusterCards = [];
    for (let i = 0; i < clusterCount; i++) {
      const card = this.shoe.dealCard(true);
      this.roundCards.push(card);
      clusterCards.push(card);
      if (!this.continuousShoe) {
        this.expectedCount += card.hilo;
      }
    }

    if (this.continuousShoe) {
      this.expectedCount = this.shoe.runningCount;
    }

    sound.playCardSlide();
    this.onCardDealt({
      clusterCards,
      roundIndex: dealtSoFar,
      totalThisRound: this.cardsPerRound
    });

    this.dealTimer = setTimeout(() => {
      this.dealBatchStep(dealtSoFar + clusterCount);
    }, this.speed);
  }

  submitUserGuess(userGuess) {
    if (this.state !== 'AWAITING_INPUT') return;

    const responseTimeMs = Math.round(performance.now() - this.questionStartTime);
    const guessNum = parseInt(userGuess, 10);
    const isCorrect = guessNum === this.expectedCount;
    const diff = Math.abs(guessNum - this.expectedCount);

    let points = 0;
    if (isCorrect) {
      points = 100;
      // Speed bonus: up to 50 extra points if answered under 3 seconds
      if (responseTimeMs < 3000) {
        points += Math.round((3000 - responseTimeMs) / 60);
      }
      sound.playCorrect();
    } else if (diff === 1) {
      points = 35; // Partial credit
      sound.playIncorrect();
    } else {
      points = 0;
      sound.playIncorrect();
    }

    const roundResult = {
      round: this.currentRound,
      userGuess: guessNum,
      actualCount: this.expectedCount,
      priorCount: this.priorCount,
      isCorrect,
      diff,
      responseTimeMs,
      points,
      cards: [...this.roundCards]
    };

    this.sessionHistory.push(roundResult);
    this.state = 'FEEDBACK';

    this.onStateChange(this.state, roundResult);
    this.onRoundFinished(roundResult);

    return roundResult;
  }

  finishSession() {
    this.state = 'SESSION_SUMMARY';
    
    const totalScore = this.sessionHistory.reduce((sum, r) => sum + r.points, 0);
    const correctCount = this.sessionHistory.filter(r => r.isCorrect).length;
    const accuracy = Math.round((correctCount / this.sessionHistory.length) * 100) || 0;
    const avgResponseTimeMs = Math.round(
      this.sessionHistory.reduce((sum, r) => sum + r.responseTimeMs, 0) / (this.sessionHistory.length || 1)
    );

    let rankTitle = 'Novice Shuffler';
    let badgeColor = 'text-amber-400';
    if (accuracy === 100 && avgResponseTimeMs < 1200) {
      rankTitle = 'MIT Blackjack Legend';
      badgeColor = 'text-purple-400';
    } else if (accuracy >= 80) {
      rankTitle = 'Vegas Pit Boss Nightmare';
      badgeColor = 'text-emerald-400';
    } else if (accuracy >= 60) {
      rankTitle = 'Card Counting Apprentice';
      badgeColor = 'text-blue-400';
    }

    const summary = {
      totalScore,
      correctCount,
      totalRounds: this.sessionHistory.length,
      accuracy,
      avgResponseTimeMs,
      rankTitle,
      badgeColor,
      history: this.sessionHistory
    };

    if (accuracy >= 80) {
      sound.playBlackjack();
    } else {
      sound.playWin();
    }

    this.onStateChange(this.state, summary);
    this.onSessionSummary(summary);
    return summary;
  }

  stop() {
    if (this.dealTimer) {
      clearTimeout(this.dealTimer);
      this.dealTimer = null;
    }
    this.state = 'IDLE';
  }
}
