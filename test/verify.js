import assert from 'assert';
import { SUITS, RANKS, getHiLoValue } from '../js/cards.js';
import { Shoe } from '../js/shoe.js';
import { evaluateHand, getOptimalStrategy, getBettingAdvice, BASIC_STRATEGY } from '../js/strategy.js';
import { BlackjackGame } from '../js/game.js';
import { MultiplayerEngine } from '../js/multiplayer.js';

console.log('--- Running Jack Black Automated Test Suite ---');

// Helper to construct card objects
function makeCard(suit, rank) {
  return {
    id: `test_${suit}_${rank}`,
    suit,
    rank,
    hilo: getHiLoValue(rank)
  };
}

// 1. Test Cards & Hi-Lo Counting Values
console.log('1. Testing Cards and Hi-Lo Values...');
assert.strictEqual(getHiLoValue('2'), 1);
assert.strictEqual(getHiLoValue('3'), 1);
assert.strictEqual(getHiLoValue('4'), 1);
assert.strictEqual(getHiLoValue('5'), 1);
assert.strictEqual(getHiLoValue('6'), 1);
assert.strictEqual(getHiLoValue('7'), 0);
assert.strictEqual(getHiLoValue('8'), 0);
assert.strictEqual(getHiLoValue('9'), 0);
assert.strictEqual(getHiLoValue('10'), -1);
assert.strictEqual(getHiLoValue('J'), -1);
assert.strictEqual(getHiLoValue('Q'), -1);
assert.strictEqual(getHiLoValue('K'), -1);
assert.strictEqual(getHiLoValue('A'), -1);
console.log('✓ Cards and Hi-Lo values verified.');

// 2. Test Shoe & Penetration
console.log('2. Testing Shoe and Penetration...');
const shoe = new Shoe(6);
assert.strictEqual(shoe.getTotalCards(), 312);
assert.strictEqual(shoe.getCardsRemaining(), 312);
assert.strictEqual(shoe.getDecksRemaining(), 6);
assert.strictEqual(shoe.needsReshuffle, false);

// Deal 10 cards and check running count arithmetic
let manualCount = 0;
for (let i = 0; i < 10; i++) {
  const card = shoe.dealCard(true);
  manualCount += getHiLoValue(card.rank);
}
assert.strictEqual(shoe.runningCount, manualCount);
console.log('✓ Shoe initialization, dealing, and count tracking verified.');

// 3. Test Hand Evaluation
console.log('3. Testing Hand Evaluation...');
const bjHand = [makeCard('SPADES', 'A'), makeCard('DIAMONDS', 'K')];
const bjEval = evaluateHand(bjHand);
assert.strictEqual(bjEval.total, 21);
assert.strictEqual(bjEval.isBlackjack, true);
assert.strictEqual(bjEval.isSoft, true);

const softHand = [makeCard('SPADES', 'A'), makeCard('CLUBS', '6')];
const softEval = evaluateHand(softHand);
assert.strictEqual(softEval.total, 17);
assert.strictEqual(softEval.isSoft, true);

const bustHand = [makeCard('SPADES', '10'), makeCard('CLUBS', '8'), makeCard('HEARTS', '6')];
const bustEval = evaluateHand(bustHand);
assert.strictEqual(bustEval.total, 24);
assert.strictEqual(bustEval.isBust, true);
console.log('✓ Hand evaluation (Blackjack, soft totals, bust) verified.');

// 4. Test Vegas Basic Strategy & Deviations
console.log('4. Testing Vegas Basic Strategy & Illustrious 18 Deviations...');
const dealerTen = makeCard('SPADES', '10');
const dealerSix = makeCard('SPADES', '6');

// Hard 11 vs 6 -> Double
const elevenHand = [makeCard('HEARTS', '5'), makeCard('DIAMONDS', '6')];
const opt11 = getOptimalStrategy(elevenHand, dealerSix, 0, true, false);
assert.strictEqual(opt11.action, 'D');

// Hard 16 vs 10: Hit at TC < 0, Stand at TC >= 0 (Illustrious 18)
const sixteenHand = [makeCard('HEARTS', '10'), makeCard('DIAMONDS', '6')];
const opt16Neg = getOptimalStrategy(sixteenHand, dealerTen, -1, false, false);
assert.strictEqual(opt16Neg.action, 'H');

const opt16Pos = getOptimalStrategy(sixteenHand, dealerTen, 1, false, false);
assert.strictEqual(opt16Pos.action, 'S');

// Pair 8,8 -> Always Split
const pairEights = [makeCard('SPADES', '8'), makeCard('DIAMONDS', '8')];
const optSplit = getOptimalStrategy(pairEights, dealerTen, 0, true, true);
assert.strictEqual(optSplit.action, 'P');
console.log('✓ Vegas Basic Strategy & Illustrious 18 deviations verified.');

// 5. Test Betting Spread Advisor
console.log('5. Testing Betting Spread Advisor...');
const adviceNeg = getBettingAdvice(-1, 10, 10, 500);
assert.strictEqual(adviceNeg.status, 'negative');
assert.strictEqual(adviceNeg.recommendedBet, 10);

const adviceHot = getBettingAdvice(4, 10, 10, 500);
assert.strictEqual(adviceHot.status, 'hot');
assert.strictEqual(adviceHot.recommendedBet >= 40, true);
console.log('✓ Betting spread advisor verified.');

// 6. Test BlackjackGame Engine & Multiplayer Seat Logic
console.log('6. Testing Game Engine & Seat Management...');
const game = new BlackjackGame({ tableSeatsCount: 3, userSeatIndex: 1 });
assert.strictEqual(game.seats.length, 3);
assert.strictEqual(game.getUserSeat().isUser, true);

// Remote seat assignment
const guestSeatIdx = game.assignPlayerToSeat('guest-peer-1', 'Charlie', '🤠');
assert.strictEqual(guestSeatIdx, 0);
assert.strictEqual(game.seats[0].isRemote, true);
assert.strictEqual(game.seats[0].name, 'Charlie');

// Remote bet update
game.handleRemoteBet('guest-peer-1', 75);
assert.strictEqual(game.seats[0].currentBet, 75);

// Remove remote seat
game.removePlayerFromSeat('guest-peer-1');
assert.strictEqual(game.seats[0].isRemote, false);
console.log('✓ Game engine seat assignment and remote bet logic verified.');

// 7. Test Multiplayer Room Code Generator
console.log('7. Testing Multiplayer Room Code Generator...');
const mp = new MultiplayerEngine();
const code = mp.generateRoomCode();
assert.strictEqual(typeof code, 'string');
assert.strictEqual(code.length, 5);
assert.match(code, /^[2-9A-Z]{5}$/);
assert.strictEqual(mp.getPeerIdForRoom(code), `jackblack-v1-room-${code}`);
console.log('✓ Multiplayer room code generation verified.');

console.log('\n✅ ALL TEST SUITES PASSED CLEANLY (7/7)!');
