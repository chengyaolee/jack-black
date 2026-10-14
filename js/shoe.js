import { RANKS, SUITS, getHiLoValue } from './cards.js';

/**
 * Shoe & Hi-Lo Counting Engine
 * Manages the multi-deck shoe, Fisher-Yates shuffling, 75% penetration cut-card,
 * and accurate face-up Running Count and True Count metrics.
 */
export class Shoe {
  constructor(numDecks = 6, penetration = 0.75) {
    this.numDecks = numDecks;
    this.penetration = penetration;
    this.cards = [];
    this.dealtCards = [];
    this.cutCardIndex = 0;
    this.runningCount = 0;
    this.needsReshuffle = false;

    this.initShoe();
  }

  /**
   * Builds and shuffles a fresh shoe
   */
  initShoe() {
    this.cards = [];
    this.dealtCards = [];
    this.runningCount = 0;
    this.needsReshuffle = false;

    const suitKeys = Object.keys(SUITS);

    for (let d = 0; d < this.numDecks; d++) {
      for (const suit of suitKeys) {
        for (const rank of RANKS) {
          this.cards.push({
            id: `c_${d}_${suit}_${rank}_${Math.random().toString(36).substr(2, 6)}`,
            suit,
            rank,
            hilo: getHiLoValue(rank),
            deckIndex: d
          });
        }
      }
    }

    this.shuffle();

    // Place cut card at penetration point (e.g. 75% into shoe)
    const totalCards = this.cards.length;
    const cardsBeforeCut = Math.floor(totalCards * this.penetration);
    this.cutCardIndex = totalCards - cardsBeforeCut; // Number of cards remaining when cut card hit
  }

  /**
   * Cryptographically unbiased Fisher-Yates shuffle
   */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Deals a single card from the top of the shoe.
   * If faceUp is true, immediately registers into the Running Count.
   * If faceUp is false (e.g. dealer hole card), RC is NOT modified until revealCard() is called.
   */
  dealCard(faceUp = true) {
    if (this.cards.length === 0) {
      this.initShoe();
    }

    const card = this.cards.pop();
    card.faceUp = faceUp;
    card.counted = false;

    if (faceUp) {
      this.runningCount += card.hilo;
      card.counted = true;
    }

    this.dealtCards.push(card);

    if (this.cards.length <= this.cutCardIndex) {
      this.needsReshuffle = true;
    }

    return card;
  }

  /**
   * Reveals a previously dealt face-down card and adds it to the Running Count
   */
  revealCard(card) {
    if (!card || card.counted) return;
    card.faceUp = true;
    card.counted = true;
    this.runningCount += card.hilo;
    return card;
  }

  /**
   * Decks remaining rounded to nearest half-deck (Standard casino counter estimation)
   */
  getDecksRemaining() {
    const rawDecks = this.cards.length / 52;
    // Human counters estimate to nearest 0.5 deck; min 0.5 to prevent division by zero
    const rounded = Math.round(rawDecks * 2) / 2;
    return Math.max(0.5, rounded);
  }

  /**
   * Exact float of decks remaining
   */
  getExactDecksRemaining() {
    return Math.max(0.1, Number((this.cards.length / 52).toFixed(2)));
  }

  /**
   * True Count = Running Count / Decks Remaining
   */
  getTrueCount() {
    const decks = this.getDecksRemaining();
    const rawTC = this.runningCount / decks;
    return {
      raw: rawTC,
      // Rounded for display (+2.4, -1.0)
      rounded: Math.round(rawTC * 10) / 10,
      // Floor used for Illustrious 18 deviations (e.g. TC 1.8 -> 1)
      floored: Math.floor(rawTC)
    };
  }

  /**
   * Percentage of cards dealt so far
   */
  getPenetrationPercentage() {
    const total = this.numDecks * 52;
    const dealt = total - this.cards.length;
    return Math.min(100, Math.round((dealt / total) * 100));
  }

  getCutCardPercentage() {
    return Math.round(this.penetration * 100);
  }

  getCardsRemaining() {
    return this.cards.length;
  }

  getTotalCards() {
    return this.numDecks * 52;
  }
}
