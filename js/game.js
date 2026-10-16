import { Shoe } from './shoe.js';
import { sound } from './audio.js';
import { evaluateHand, getOptimalStrategy, getDealerUpcardKey } from './strategy.js';
import { getHiLoValue } from './cards.js';

export const AI_BOT_PROFILES = [
  { name: 'Rain Man Bob', avatar: '🧠', tag: 'Counter Bot' },
  { name: 'Wild Wendy', avatar: '💃', tag: 'High Roller' },
  { name: 'Tourist Tony', avatar: '🌴', tag: 'Vacationer' },
  { name: 'Calculated Chloe', avatar: '📊', tag: 'Statistician' },
  { name: 'Lucky Lou', avatar: '🍀', tag: 'Gambler' }
];

export class BlackjackGame {
  constructor(options = {}) {
    this.numDecks = options.numDecks || 6;
    this.tableSeatsCount = options.tableSeatsCount || 3; // 1 to 5 seats
    this.userSeatIndex = options.userSeatIndex !== undefined ? options.userSeatIndex : 1; // 0-indexed
    this.aiDelta = options.aiDelta !== undefined ? options.aiDelta : 0.0; // 0.0 = basic strategy, 1.0 = crazy random
    this.dealerHitsSoft17 = options.dealerHitsSoft17 || false; // Vegas standard: S17 (stands on all 17s)
    this.minBet = options.minBet || 10;
    this.maxBet = options.maxBet || 500;

    this.shoe = new Shoe(this.numDecks);
    this.phase = 'BETTING'; // 'BETTING', 'DEALING', 'INSURANCE', 'PLAYING', 'DEALER_TURN', 'SETTLING', 'ROUND_OVER'
    
    this.dealer = {
      cards: [],
      info: { total: 0, isBust: false, isBlackjack: false, isSoft: false }
    };

    this.seats = [];
    this.activeSeatIndex = -1;
    this.activeHandIndex = 0; // For split hands
    this.cutCardNotified = false;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onCardDealt = options.onCardDealt || (() => {});
    this.onSeatUpdate = options.onSeatUpdate || (() => {});
    this.onDealerUpdate = options.onDealerUpdate || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.onBroadcast = options.onBroadcast || null;

    this.initSeats();
  }

  initSeats() {
    this.seats = [];
    let botProfileIdx = 0;

    for (let i = 0; i < this.tableSeatsCount; i++) {
      const isUser = i === this.userSeatIndex;
      const bot = isUser ? null : AI_BOT_PROFILES[botProfileIdx++ % AI_BOT_PROFILES.length];

      this.seats.push({
        index: i,
        isUser,
        isRemote: false,
        peerId: null,
        name: isUser ? 'You' : bot.name,
        avatar: isUser ? '😎' : bot.avatar,
        tag: isUser ? 'Player' : bot.tag,
        bankroll: isUser ? (this.loadBankroll() || 1000) : 1000,
        currentBet: isUser ? this.minBet : this.minBet,
        insuranceBet: 0,
        hands: [
          {
            cards: [],
            info: { total: 0, isBust: false, isBlackjack: false, isSoft: false, isPair: false },
            status: 'WAITING', // 'WAITING', 'ACTIVE', 'STOOD', 'BUSTED', 'BLACKJACK', 'WON', 'LOST', 'PUSHED'
            bet: isUser ? this.minBet : this.minBet,
            isSplitHand: false,
            doubled: false
          }
        ],
        lastAction: null,
        speechBubble: null
      });
    }
  }

  setSeatCount(count) {
    this.tableSeatsCount = Math.max(1, Math.min(5, count));
    if (this.userSeatIndex >= this.tableSeatsCount) {
      this.userSeatIndex = this.tableSeatsCount - 1;
    }
    this.initSeats();
    this.notifyUpdate();
  }

  setAiDelta(delta) {
    this.aiDelta = Math.max(0, Math.min(1, parseFloat(delta)));
  }

  loadBankroll() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('jb_bankroll');
      return saved ? parseInt(saved, 10) : 1000;
    }
    return 1000;
  }

  saveBankroll(amount) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jb_bankroll', amount);
    }
  }

  getUserSeat() {
    return this.seats[this.userSeatIndex];
  }

  setUserBet(amount) {
    if (this.phase !== 'BETTING') return false;
    const user = this.getUserSeat();
    if (!user) return false;

    const bet = Math.max(this.minBet, Math.min(user.bankroll, Math.min(this.maxBet, amount)));
    user.currentBet = bet;
    user.hands[0].bet = bet;
    sound.playChipClink();
    this.notifyUpdate();
    return true;
  }

  addUserChip(value) {
    if (this.phase !== 'BETTING') return;
    const user = this.getUserSeat();
    if (!user) return;

    const newBet = user.currentBet + value;
    this.setUserBet(newBet);
  }

  clearUserBet() {
    if (this.phase !== 'BETTING') return;
    this.setUserBet(this.minBet);
  }

  rebuyBankroll(amount = 1000) {
    const user = this.getUserSeat();
    if (user) {
      user.bankroll = (user.bankroll || 0) + amount;
      this.saveBankroll(user.bankroll);
      this.setUserBet(this.minBet);
      sound.playChipClink();
      this.notifyUpdate();
    }
  }

  /**
   * Starts a new round, dealing initial cards to all active seats
   */
  async startDeal() {
    if (this.phase !== 'BETTING') return;

    // Check if shoe reached cut card in previous round
    if (this.shoe.needsReshuffle) {
      this.onMessage({ type: 'reshuffle', text: 'Cut card reached! Dealer is shuffling a fresh 6-deck shoe...' });
      this.shoe.initShoe();
      await this.sleep(1200);
    }

    const user = this.getUserSeat();
    if (user.bankroll < this.minBet) {
      user.bankroll = 1000;
      this.saveBankroll(user.bankroll);
      this.setUserBet(this.minBet);
      this.onMessage({ type: 'info', text: 'Casino credit reload: +$1,000 added to your bankroll!' });
    } else if (user.bankroll < user.currentBet) {
      this.setUserBet(user.bankroll);
    }

    this.phase = 'DEALING';
    this.activeSeatIndex = -1;
    this.activeHandIndex = 0;

    // Reset dealer
    this.dealer = {
      cards: [],
      info: { total: 0, isBust: false, isBlackjack: false, isSoft: false }
    };

    // Deduct bets from players
    for (const seat of this.seats) {
      // AI bets based on count and delta
      if (!seat.isUser && !seat.isRemote) {
        seat.currentBet = this.calculateAiBet(seat);
      }
      if (seat.bankroll < this.minBet) {
        seat.bankroll = 1000;
        seat.currentBet = this.minBet;
      }
      seat.bankroll -= seat.currentBet;
      if (seat.isUser) this.saveBankroll(seat.bankroll);

      seat.insuranceBet = 0;
      seat.lastAction = null;
      seat.speechBubble = null;
      seat.hands = [
        {
          cards: [],
          info: { total: 0, isBust: false, isBlackjack: false, isSoft: false, isPair: false },
          status: 'ACTIVE',
          bet: seat.currentBet,
          isSplitHand: false,
          doubled: false
        }
      ];
    }

    this.notifyUpdate();

    // Deal First Card to each seat
    for (const seat of this.seats) {
      await this.sleep(220);
      const card = this.shoe.dealCard(true);
      seat.hands[0].cards.push(card);
      seat.hands[0].info = evaluateHand(seat.hands[0].cards);
      sound.playCardSlide();
      this.notifyUpdate();
    }

    // Deal First Card to Dealer (Face Up)
    await this.sleep(250);
    const dealerUpcard = this.shoe.dealCard(true);
    this.dealer.cards.push(dealerUpcard);
    this.dealer.info = evaluateHand(this.dealer.cards);
    sound.playCardSlide();
    this.notifyUpdate();

    // Deal Second Card to each seat
    for (const seat of this.seats) {
      await this.sleep(220);
      const card = this.shoe.dealCard(true);
      seat.hands[0].cards.push(card);
      seat.hands[0].info = evaluateHand(seat.hands[0].cards);
      sound.playCardSlide();
      this.notifyUpdate();
    }

    // Deal Second Card to Dealer (Hole Card: Face Down!)
    // Note: NOT counted in running count until revealed
    await this.sleep(250);
    const holeCard = this.shoe.dealCard(false);
    this.dealer.cards.push(holeCard);
    // Evaluated internally so dealer knows if upcard is Ace/10
    sound.playCardSlide();
    this.notifyUpdate();

    // Check for player naturals (Blackjack)
    for (const seat of this.seats) {
      if (seat.hands[0].info.isBlackjack) {
        seat.hands[0].status = 'BLACKJACK';
        if (seat.isUser) sound.playBlackjack();
      }
    }

    // Check Insurance if Dealer upcard is Ace
    if (dealerUpcard.rank === 'A') {
      this.phase = 'INSURANCE';
      this.notifyUpdate();
      // If user seat, we wait for user insurance decision or AI decisions
      await this.handleInsurancePhase();
      return;
    }

    // If Dealer upcard is 10, peek for Blackjack
    if (['10', 'J', 'Q', 'K'].includes(dealerUpcard.rank)) {
      const fullDealerHand = evaluateHand(this.dealer.cards);
      if (fullDealerHand.isBlackjack) {
        await this.handleDealerBlackjackImmediate();
        return;
      }
    }

    // Proceed to player turns
    this.phase = 'PLAYING';
    this.startPlayerTurns();
  }

  calculateAiBet(seat) {
    const tc = this.shoe.getTrueCount().floored;
    let bet = this.minBet;

    // If delta is 0 (optimal), follow card counting bet spread
    if (Math.random() > this.aiDelta) {
      if (tc >= 4) bet = Math.min(this.maxBet, this.minBet * 6);
      else if (tc === 3) bet = Math.min(this.maxBet, this.minBet * 4);
      else if (tc === 2) bet = Math.min(this.maxBet, this.minBet * 2);
      else bet = this.minBet;
    } else {
      // Crazy random bet
      const multipliers = [1, 1, 2, 3, 5, 1];
      const m = multipliers[Math.floor(Math.random() * multipliers.length)];
      bet = Math.min(seat.bankroll, this.minBet * m);
    }
    return Math.min(seat.bankroll, bet);
  }

  async handleInsurancePhase() {
    // If user has enough bankroll, wait for user input; AI makes insurance decisions automatically
    for (const seat of this.seats) {
      if (!seat.isUser && !seat.isRemote) {
        const tc = this.shoe.getTrueCount().floored;
        // Basic strategy: decline insurance. Illustrious 18: take insurance if TC >= +3
        const takesInsurance = (Math.random() > this.aiDelta) ? (tc >= 3) : (Math.random() < 0.4);
        if (takesInsurance && seat.bankroll >= Math.floor(seat.currentBet / 2)) {
          const insAmount = Math.floor(seat.currentBet / 2);
          seat.bankroll -= insAmount;
          seat.insuranceBet = insAmount;
          seat.speechBubble = 'Took Insurance!';
        }
      }
    }
    this.notifyUpdate();

    // Check if user has option for insurance
    const user = this.getUserSeat();
    if (!user || user.hands[0].status === 'BLACKJACK' || user.bankroll < Math.floor(user.currentBet / 2)) {
      // Auto resolve insurance
      this.resolveInsuranceDecision(false);
    }
    // Otherwise, wait for user to click Yes or No on Insurance prompt in UI
  }

  resolveInsuranceDecision(userTakesInsurance) {
    const user = this.getUserSeat();
    if (user && userTakesInsurance) {
      const insAmount = Math.floor(user.currentBet / 2);
      if (user.bankroll >= insAmount) {
        user.bankroll -= insAmount;
        user.insuranceBet = insAmount;
        this.saveBankroll(user.bankroll);
      }
    }

    // Dealer checks hole card for Blackjack
    const dealerHand = evaluateHand(this.dealer.cards);
    if (dealerHand.isBlackjack) {
      this.handleDealerBlackjackImmediate();
    } else {
      // Dealer does not have BJ; insurance bets are lost
      for (const seat of this.seats) {
        seat.insuranceBet = 0;
      }
      this.onMessage({ type: 'info', text: 'Dealer does not have Blackjack. Insurance bets lost.' });
      this.phase = 'PLAYING';
      this.startPlayerTurns();
    }
  }

  async handleDealerBlackjackImmediate() {
    // Reveal dealer hole card immediately
    await this.sleep(400);
    this.shoe.revealCard(this.dealer.cards[1]);
    this.dealer.info = evaluateHand(this.dealer.cards);
    sound.playCardFlip();
    this.notifyUpdate();

    this.onMessage({ type: 'info', text: 'Dealer has Blackjack!' });

    // Insurance payouts
    for (const seat of this.seats) {
      if (seat.insuranceBet > 0) {
        const payout = seat.insuranceBet * 3; // 2:1 payout + return of bet
        seat.bankroll += payout;
        seat.speechBubble = `Insurance won +$${seat.insuranceBet * 2}!`;
      }
    }

    await this.sleep(1000);
    this.settleRound();
  }

  startPlayerTurns() {
    this.activeSeatIndex = 0;
    this.activeHandIndex = 0;
    this.processCurrentSeatTurn();
  }

  async processCurrentSeatTurn() {
    if (this.activeSeatIndex >= this.seats.length) {
      // All player seats finished; proceed to Dealer turn
      this.phase = 'DEALER_TURN';
      this.notifyUpdate();
      await this.playDealerTurn();
      return;
    }

    const currentSeat = this.seats[this.activeSeatIndex];
    const currentHand = currentSeat.hands[this.activeHandIndex];

    // Check if seat already has Blackjack or is Busted
    if (currentHand.status === 'BLACKJACK' || currentHand.info.isBlackjack) {
      this.advanceToNextHandOrSeat();
      return;
    }

    if (currentSeat.isUser || currentSeat.isRemote) {
      // Wait for player action (local UI buttons or WebRTC network action)
      this.notifyUpdate();
      return;
    }

    // AI Seat plays automatically
    await this.sleep(700);
    await this.playAiTurn(currentSeat, currentHand);
  }

  async playAiTurn(seat, hand) {
    const dealerUpcard = this.dealer.cards[0];
    const trueCount = this.shoe.getTrueCount();
    const canDouble = hand.cards.length === 2 && seat.bankroll >= hand.bet;
    const canSplit = hand.cards.length === 2 && hand.info.isPair && seat.bankroll >= hand.bet && seat.hands.length < 4;

    const optimal = getOptimalStrategy(hand.cards, dealerUpcard, trueCount, canDouble, canSplit);

    let chosenAction = optimal.action;
    let isCrazy = false;

    // Delta simulation: roll for crazy play
    if (Math.random() <= this.aiDelta) {
      isCrazy = true;
      const validActions = ['H', 'S'];
      if (canDouble) validActions.push('D');
      if (canSplit) validActions.push('P');

      // Random choice among legal actions
      // Bias slightly away from instant suicide on 20, but allow weird hits on 16/17/18
      const randomAction = validActions[Math.floor(Math.random() * validActions.length)];
      if (hand.info.total < 21) {
        chosenAction = randomAction;
      }
    }

    // Execute AI action
    if (chosenAction === 'H') {
      seat.lastAction = 'Hit';
      seat.speechBubble = isCrazy ? '🤪 Crazy Hit!' : 'Hit';
      this.executeHit(seat, hand);
    } else if (chosenAction === 'D') {
      seat.lastAction = 'Double Down';
      seat.speechBubble = isCrazy ? '🎲 Wild Double!' : 'Double';
      this.executeDouble(seat, hand);
    } else if (chosenAction === 'P') {
      seat.lastAction = 'Split';
      seat.speechBubble = isCrazy ? '✂️ Spontaneous Split!' : 'Split';
      this.executeSplit(seat, hand);
    } else {
      seat.lastAction = 'Stand';
      seat.speechBubble = isCrazy && hand.info.total < 15 ? '😱 Wild Stand!' : 'Stand';
      this.executeStand(seat, hand);
    }

    this.notifyUpdate();

    // If still in play and hasn't stood or busted
    if (hand.status === 'ACTIVE' && hand.info.total < 21 && chosenAction === 'H') {
      await this.sleep(600);
      await this.playAiTurn(seat, hand);
    } else {
      await this.sleep(500);
      this.advanceToNextHandOrSeat();
    }
  }

  // User Actions
  userHit() {
    const user = this.getUserSeat();
    if (!user || this.phase !== 'PLAYING' || this.activeSeatIndex !== this.userSeatIndex) return;

    const hand = user.hands[this.activeHandIndex];
    if (hand.status !== 'ACTIVE') return;

    this.executeHit(user, hand);
    this.notifyUpdate();

    if (hand.status !== 'ACTIVE' || hand.info.total >= 21) {
      setTimeout(() => this.advanceToNextHandOrSeat(), 400);
    }
  }

  userStand() {
    const user = this.getUserSeat();
    if (!user || this.phase !== 'PLAYING' || this.activeSeatIndex !== this.userSeatIndex) return;

    const hand = user.hands[this.activeHandIndex];
    this.executeStand(user, hand);
    this.notifyUpdate();

    setTimeout(() => this.advanceToNextHandOrSeat(), 300);
  }

  userDouble() {
    const user = this.getUserSeat();
    if (!user || this.phase !== 'PLAYING' || this.activeSeatIndex !== this.userSeatIndex) return;

    const hand = user.hands[this.activeHandIndex];
    if (hand.cards.length !== 2 || user.bankroll < hand.bet) return;

    this.executeDouble(user, hand);
    this.notifyUpdate();

    setTimeout(() => this.advanceToNextHandOrSeat(), 500);
  }

  userSplit() {
    const user = this.getUserSeat();
    if (!user || this.phase !== 'PLAYING' || this.activeSeatIndex !== this.userSeatIndex) return;

    const hand = user.hands[this.activeHandIndex];
    if (hand.cards.length !== 2 || !hand.info.isPair || user.bankroll < hand.bet) return;

    this.executeSplit(user, hand);
    this.notifyUpdate();
  }

  // Core Mechanics
  executeHit(seat, hand) {
    const card = this.shoe.dealCard(true);
    hand.cards.push(card);
    hand.info = evaluateHand(hand.cards);
    sound.playCardSlide();

    if (hand.info.isBust) {
      hand.status = 'BUSTED';
      sound.playBust();
      seat.speechBubble = 'Bust! 💥';
    } else if (hand.info.total === 21) {
      hand.status = 'STOOD';
      sound.playWin();
      seat.speechBubble = '21! 🎯';
    }
  }

  executeStand(seat, hand) {
    hand.status = 'STOOD';
    seat.speechBubble = 'Stand';
  }

  executeDouble(seat, hand) {
    seat.bankroll -= hand.bet;
    if (seat.isUser) this.saveBankroll(seat.bankroll);
    hand.bet *= 2;
    hand.doubled = true;
    sound.playChipClink();

    // Deal exactly one card
    const card = this.shoe.dealCard(true);
    hand.cards.push(card);
    hand.info = evaluateHand(hand.cards);
    sound.playCardSlide();

    if (hand.info.isBust) {
      hand.status = 'BUSTED';
      sound.playBust();
      seat.speechBubble = 'Double Bust! 💥';
    } else {
      hand.status = 'STOOD';
    }
  }

  executeSplit(seat, hand) {
    seat.bankroll -= hand.bet;
    if (seat.isUser) this.saveBankroll(seat.bankroll);
    sound.playChipClink();

    const secondCard = hand.cards.pop();
    const isAces = hand.cards[0].rank === 'A';

    // Create second split hand
    const newHand = {
      cards: [secondCard],
      info: evaluateHand([secondCard]),
      status: 'ACTIVE',
      bet: hand.bet,
      isSplitHand: true,
      doubled: false
    };

    seat.hands.splice(this.activeHandIndex + 1, 0, newHand);

    // Deal one card to first split hand
    const card1 = this.shoe.dealCard(true);
    hand.cards.push(card1);
    hand.info = evaluateHand(hand.cards);

    // Deal one card to second split hand
    const card2 = this.shoe.dealCard(true);
    newHand.cards.push(card2);
    newHand.info = evaluateHand(newHand.cards);
    sound.playCardSlide();

    // Vegas Rule: Split Aces receive only 1 card each and cannot be hit further
    if (isAces) {
      hand.status = 'STOOD';
      newHand.status = 'STOOD';
      setTimeout(() => this.advanceToNextHandOrSeat(), 400);
    }
  }

  advanceToNextHandOrSeat() {
    const currentSeat = this.seats[this.activeSeatIndex];
    if (currentSeat && this.activeHandIndex < currentSeat.hands.length - 1) {
      // Seat has another split hand to play
      this.activeHandIndex++;
      this.processCurrentSeatTurn();
      return;
    }

    // Move to next seat
    this.activeSeatIndex++;
    this.activeHandIndex = 0;
    this.processCurrentSeatTurn();
  }

  async playDealerTurn() {
    // Check if all player hands busted
    let allPlayersBusted = true;
    for (const seat of this.seats) {
      for (const hand of seat.hands) {
        if (hand.status !== 'BUSTED') {
          allPlayersBusted = false;
          break;
        }
      }
    }

    // Reveal hole card
    await this.sleep(400);
    this.shoe.revealCard(this.dealer.cards[1]);
    this.dealer.info = evaluateHand(this.dealer.cards);
    sound.playCardFlip();
    this.notifyUpdate();

    // If all players busted, dealer doesn't need to draw more cards
    if (allPlayersBusted) {
      await this.sleep(600);
      this.settleRound();
      return;
    }

    // Dealer draws cards until reaching 17 (or soft 17 if H17 toggle)
    while (true) {
      const info = this.dealer.info;
      const shouldHit = this.dealerHitsSoft17 
        ? (info.total < 17 || (info.total === 17 && info.isSoft))
        : (info.total < 17);

      if (!shouldHit) break;

      await this.sleep(600);
      const card = this.shoe.dealCard(true);
      this.dealer.cards.push(card);
      this.dealer.info = evaluateHand(this.dealer.cards);
      sound.playCardSlide();
      this.notifyUpdate();
    }

    await this.sleep(600);
    this.settleRound();
  }

  settleRound() {
    this.phase = 'SETTLING';
    const dealerInfo = this.dealer.info;
    const dealerTotal = dealerInfo.total;
    const dealerBust = dealerInfo.isBust;
    const dealerBJ = dealerInfo.isBlackjack;

    for (const seat of this.seats) {
      for (const hand of seat.hands) {
        const playerInfo = hand.info;
        const playerTotal = playerInfo.total;
        const playerBJ = hand.status === 'BLACKJACK' || playerInfo.isBlackjack;

        if (hand.status === 'BUSTED') {
          hand.status = 'LOST';
          seat.speechBubble = 'Lost';
          continue;
        }

        if (playerBJ) {
          if (dealerBJ) {
            hand.status = 'PUSHED';
            seat.bankroll += hand.bet; // Bet returned
            seat.speechBubble = 'Push (BJ)';
          } else {
            hand.status = 'WON';
            // Natural Blackjack pays 3:2
            const winAmount = Math.floor(hand.bet * 2.5);
            seat.bankroll += winAmount;
            seat.speechBubble = 'Blackjack! +$' + (winAmount - hand.bet);
          }
        } else if (dealerBJ) {
          hand.status = 'LOST';
          seat.speechBubble = 'Dealer BJ';
        } else if (dealerBust) {
          hand.status = 'WON';
          const winAmount = hand.bet * 2;
          seat.bankroll += winAmount;
          seat.speechBubble = 'Dealer Bust! Won +$' + hand.bet;
        } else if (playerTotal > dealerTotal) {
          hand.status = 'WON';
          const winAmount = hand.bet * 2;
          seat.bankroll += winAmount;
          seat.speechBubble = 'Won +$' + hand.bet;
        } else if (playerTotal === dealerTotal) {
          hand.status = 'PUSHED';
          seat.bankroll += hand.bet;
          seat.speechBubble = 'Push';
        } else {
          hand.status = 'LOST';
          seat.speechBubble = 'Lost';
        }
      }

      if (seat.isUser) {
        this.saveBankroll(seat.bankroll);
        const userWon = seat.hands.some(h => h.status === 'WON');
        const userPush = seat.hands.some(h => h.status === 'PUSHED');
        if (userWon) sound.playWin();
        else if (userPush) sound.playPush();
      }
    }

    this.phase = 'ROUND_OVER';
    this.notifyUpdate();
  }

  readyNextBettingPhase() {
    this.phase = 'BETTING';
    this.dealer = { cards: [], info: { total: 0, isBust: false, isBlackjack: false, isSoft: false } };
    for (const seat of this.seats) {
      seat.lastAction = null;
      seat.speechBubble = null;
      seat.insuranceBet = 0;
      seat.hands = [
        {
          cards: [],
          info: { total: 0, isBust: false, isBlackjack: false, isSoft: false, isPair: false },
          status: 'WAITING',
          bet: seat.currentBet,
          isSplitHand: false,
          doubled: false
        }
      ];
    }
    this.notifyUpdate();
  }

  // Remote Multiplayer Helpers
  findOpenSeat() {
    // First look for any existing AI seat
    for (let i = 0; i < this.seats.length; i++) {
      if (!this.seats[i].isUser && !this.seats[i].isRemote) {
        return i;
      }
    }
    // If table has fewer than 5 seats, we can expand by 1
    if (this.seats.length < 5) {
      const newIndex = this.seats.length;
      this.tableSeatsCount = newIndex + 1;
      const bot = AI_BOT_PROFILES[newIndex % AI_BOT_PROFILES.length];
      this.seats.push({
        index: newIndex,
        isUser: false,
        isRemote: false,
        peerId: null,
        name: bot.name,
        avatar: bot.avatar,
        tag: bot.tag,
        bankroll: 1000,
        currentBet: this.minBet,
        insuranceBet: 0,
        hands: [
          {
            cards: [],
            info: { total: 0, isBust: false, isBlackjack: false, isSoft: false, isPair: false },
            status: 'WAITING',
            bet: this.minBet,
            isSplitHand: false,
            doubled: false
          }
        ],
        lastAction: null,
        speechBubble: null
      });
      return newIndex;
    }
    return -1;
  }

  assignPlayerToSeat(peerId, name = 'Player', avatar = '🤠') {
    const seatIdx = this.findOpenSeat();
    if (seatIdx === -1) return -1;

    const seat = this.seats[seatIdx];
    seat.isRemote = true;
    seat.isUser = false;
    seat.peerId = peerId;
    seat.name = name;
    seat.avatar = avatar;
    seat.tag = 'Guest';
    seat.bankroll = 1000;
    seat.currentBet = this.minBet;
    seat.hands[0].bet = this.minBet;
    seat.speechBubble = 'Joined table!';
    this.notifyUpdate();
    return seatIdx;
  }

  removePlayerFromSeat(peerId) {
    const seat = this.seats.find(s => s.peerId === peerId);
    if (!seat) return;

    const bot = AI_BOT_PROFILES[seat.index % AI_BOT_PROFILES.length];
    seat.isRemote = false;
    seat.isUser = false;
    seat.peerId = null;
    seat.name = bot.name;
    seat.avatar = bot.avatar;
    seat.tag = bot.tag;
    seat.bankroll = 1000;
    seat.speechBubble = 'Left table';
    this.notifyUpdate();
  }

  handleRemoteBet(peerId, amount) {
    if (this.phase !== 'BETTING') return;
    const seat = this.seats.find(s => s.peerId === peerId);
    if (!seat) return;

    const bet = Math.max(this.minBet, Math.min(seat.bankroll, Math.min(this.maxBet, amount)));
    seat.currentBet = bet;
    seat.hands[0].bet = bet;
    sound.playChipClink();
    this.notifyUpdate();
  }

  handleRemoteInsurance(peerId, take) {
    if (this.phase !== 'INSURANCE') return;
    const seat = this.seats.find(s => s.peerId === peerId);
    if (!seat) return;

    if (take && seat.bankroll >= Math.floor(seat.currentBet / 2)) {
      const insAmount = Math.floor(seat.currentBet / 2);
      seat.bankroll -= insAmount;
      seat.insuranceBet = insAmount;
      seat.speechBubble = 'Took Insurance!';
    } else {
      seat.speechBubble = 'Declined Insurance';
    }
    this.notifyUpdate();
  }

  handleRemoteAction(peerId, action) {
    if (this.phase !== 'PLAYING') return;
    const seat = this.seats[this.activeSeatIndex];
    if (!seat || seat.peerId !== peerId) return;

    const hand = seat.hands[this.activeHandIndex];
    if (!hand || hand.status !== 'ACTIVE') return;

    const upperAction = (action || '').toUpperCase();
    if (upperAction === 'HIT') {
      seat.lastAction = 'Hit';
      seat.speechBubble = 'Hit';
      this.executeHit(seat, hand);
      this.notifyUpdate();
      if (hand.status !== 'ACTIVE' || hand.info.total >= 21) {
        setTimeout(() => this.advanceToNextHandOrSeat(), 400);
      }
    } else if (upperAction === 'STAND') {
      seat.lastAction = 'Stand';
      this.executeStand(seat, hand);
      this.notifyUpdate();
      setTimeout(() => this.advanceToNextHandOrSeat(), 300);
    } else if (upperAction === 'DOUBLE') {
      if (hand.cards.length === 2 && seat.bankroll >= hand.bet) {
        seat.lastAction = 'Double Down';
        this.executeDouble(seat, hand);
        this.notifyUpdate();
        setTimeout(() => this.advanceToNextHandOrSeat(), 500);
      }
    } else if (upperAction === 'SPLIT') {
      if (hand.cards.length === 2 && hand.info.isPair && seat.bankroll >= hand.bet && seat.hands.length < 4) {
        seat.lastAction = 'Split';
        this.executeSplit(seat, hand);
        this.notifyUpdate();
      }
    }
  }

  notifyUpdate() {
    const data = {
      dealer: this.dealer,
      seats: this.seats,
      activeSeatIndex: this.activeSeatIndex,
      activeHandIndex: this.activeHandIndex,
      phase: this.phase,
      shoe: {
        cardsLeft: this.shoe.getCardsRemaining(),
        totalCards: this.shoe.getTotalCards(),
        runningCount: this.shoe.runningCount,
        decksRemaining: this.shoe.getDecksRemaining(),
        trueCount: this.shoe.getTrueCount(),
        penetration: this.shoe.getPenetrationPercentage(),
        cutCardReached: this.shoe.needsReshuffle
      }
    };
    this.onStateChange(this.phase, data);
    if (this.onBroadcast) {
      this.onBroadcast(data);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
