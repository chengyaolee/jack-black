/**
 * Vegas Basic Strategy & Illustrious 18 Count Deviations Engine
 * Includes Hand Evaluator, Action Matrix (Hard, Soft, Pairs),
 * Count-based Strategy Deviations, and Betting Spread Advisor.
 */

export function evaluateHand(cards) {
  let total = 0;
  let aceCount = 0;

  for (const c of cards) {
    if (c.rank === 'A') {
      aceCount += 1;
      total += 11;
    } else if (['K', 'Q', 'J', '10'].includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }

  // Soft aces adjustment
  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount -= 1;
  }

  const isBust = total > 21;
  const isBlackjack = cards.length === 2 && total === 21;
  const isSoft = aceCount > 0;
  const isPair = cards.length === 2 && (
    cards[0].rank === cards[1].rank ||
    (['10', 'J', 'Q', 'K'].includes(cards[0].rank) && ['10', 'J', 'Q', 'K'].includes(cards[1].rank))
  );

  return {
    total,
    isBust,
    isBlackjack,
    isSoft,
    isPair,
    cardsCount: cards.length
  };
}

// Convert card rank to matrix column index key: '2'..'10', 'A'
export function getDealerUpcardKey(dealerCard) {
  if (!dealerCard) return '10';
  const rank = dealerCard.rank;
  if (['K', 'Q', 'J', '10'].includes(rank)) return '10';
  return rank;
}

/**
 * Standard Vegas 6-Deck S17 (Dealer Stands on Soft 17), Double After Split (DAS)
 * Legend:
 * H: Hit
 * S: Stand
 * D: Double if allowed, else Hit
 * Ds: Double if allowed, else Stand
 * P: Split
 */
export const BASIC_STRATEGY = {
  // Hard totals: row is player hard total (5-20)
  hard: {
    // 5-8: Always Hit
    8:  { '2': 'H', '3': 'H', '4': 'H', '5': 'H', '6': 'H', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    9:  { '2': 'H', '3': 'D', '4': 'D', '5': 'D', '6': 'D', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    10: { '2': 'D', '3': 'D', '4': 'D', '5': 'D', '6': 'D', '7': 'D', '8': 'D', '9': 'D', '10': 'H', 'A': 'H' },
    11: { '2': 'D', '3': 'D', '4': 'D', '5': 'D', '6': 'D', '7': 'D', '8': 'D', '9': 'D', '10': 'D', 'A': 'H' },
    12: { '2': 'H', '3': 'H', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    13: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    14: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    15: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    16: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    17: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
    18: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
    19: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
    20: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
    21: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' }
  },

  // Soft totals: row is non-Ace card rank
  soft: {
    // A,2 & A,3 (Soft 13 & 14)
    2: { '2': 'H', '3': 'H', '4': 'H', '5': 'D', '6': 'D', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    3: { '2': 'H', '3': 'H', '4': 'H', '5': 'D', '6': 'D', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    // A,4 & A,5 (Soft 15 & 16)
    4: { '2': 'H', '3': 'H', '4': 'D', '5': 'D', '6': 'D', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    5: { '2': 'H', '3': 'H', '4': 'D', '5': 'D', '6': 'D', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    // A,6 (Soft 17)
    6: { '2': 'H', '3': 'D', '4': 'D', '5': 'D', '6': 'D', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    // A,7 (Soft 18)
    7: { '2': 'Ds', '3': 'Ds', '4': 'Ds', '5': 'Ds', '6': 'Ds', '7': 'S', '8': 'S', '9': 'H', '10': 'H', 'A': 'H' },
    // A,8 (Soft 19)
    8: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'Ds', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
    // A,9 (Soft 20)
    9: { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' }
  },

  // Pairs
  pairs: {
    '2':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'P', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    '3':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'P', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    '4':  { '2': 'H', '3': 'H', '4': 'H', '5': 'P', '6': 'P', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    '5':  { '2': 'D', '3': 'D', '4': 'D', '5': 'D', '6': 'D', '7': 'D', '8': 'D', '9': 'D', '10': 'H', 'A': 'H' },
    '6':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    '7':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'P', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
    '8':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'P', '8': 'P', '9': 'P', '10': 'P', 'A': 'P' },
    '9':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'S', '8': 'P', '9': 'P', '10': 'S', 'A': 'S' },
    '10': { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
    'A':  { '2': 'P', '3': 'P', '4': 'P', '5': 'P', '6': 'P', '7': 'P', '8': 'P', '9': 'P', '10': 'P', 'A': 'P' }
  }
};

/**
 * Checks for Illustrious 18 count deviations
 */
export function checkIllustrious18Deviation(playerInfo, dealerUpcardKey, trueCount) {
  const tc = trueCount.floored;
  const tcExact = trueCount.rounded;

  // 1. Insurance: TC >= +3 -> Take Insurance
  // (Handled separately in insurance phase)

  // 2. 16 vs 10: Stand if TC >= 0 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 16 && dealerUpcardKey === '10') {
    if (tc >= 0) {
      return { action: 'S', reason: `Count Deviation: Stand on 16 vs 10 because True Count (${tcExact}) ≥ 0.` };
    }
    return { action: 'H', reason: `Basic Strategy: Hit on 16 vs 10 because True Count (${tcExact}) < 0.` };
  }

  // 3. 15 vs 10: Stand if TC >= +4 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 15 && dealerUpcardKey === '10') {
    if (tc >= 4) {
      return { action: 'S', reason: `Count Deviation: Stand on 15 vs 10 because True Count (${tcExact}) ≥ +4.` };
    }
  }

  // 4. Pair 10s (20) vs 5 or 6: Split if TC >= +5 (normally Stand)
  if (playerInfo.isPair && playerInfo.total === 20 && (dealerUpcardKey === '5' || dealerUpcardKey === '6')) {
    if (tc >= 5) {
      return { action: 'P', reason: `High Count Deviation: Split 10s vs ${dealerUpcardKey} because True Count (${tcExact}) ≥ +5.` };
    }
  }

  // 5. 10 vs 10: Double if TC >= +4 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 10 && dealerUpcardKey === '10') {
    if (tc >= 4) {
      return { action: 'D', reason: `Count Deviation: Double 10 vs 10 because True Count (${tcExact}) ≥ +4.` };
    }
  }

  // 6. 12 vs 3: Stand if TC >= +2 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 12 && dealerUpcardKey === '3') {
    if (tc >= 2) {
      return { action: 'S', reason: `Count Deviation: Stand on 12 vs 3 because True Count (${tcExact}) ≥ +2.` };
    }
  }

  // 7. 12 vs 2: Stand if TC >= +3 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 12 && dealerUpcardKey === '2') {
    if (tc >= 3) {
      return { action: 'S', reason: `Count Deviation: Stand on 12 vs 2 because True Count (${tcExact}) ≥ +3.` };
    }
  }

  // 8. 11 vs A: Double if TC >= +1 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 11 && dealerUpcardKey === 'A') {
    if (tc >= 1) {
      return { action: 'D', reason: `Count Deviation: Double 11 vs Ace because True Count (${tcExact}) ≥ +1.` };
    }
  }

  // 9. 9 vs 2: Double if TC >= +1 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 9 && dealerUpcardKey === '2') {
    if (tc >= 1) {
      return { action: 'D', reason: `Count Deviation: Double 9 vs 2 because True Count (${tcExact}) ≥ +1.` };
    }
  }

  // 10. 10 vs A: Double if TC >= +4 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 10 && dealerUpcardKey === 'A') {
    if (tc >= 4) {
      return { action: 'D', reason: `Count Deviation: Double 10 vs Ace because True Count (${tcExact}) ≥ +4.` };
    }
  }

  // 11. 9 vs 7: Double if TC >= +3 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 9 && dealerUpcardKey === '7') {
    if (tc >= 3) {
      return { action: 'D', reason: `Count Deviation: Double 9 vs 7 because True Count (${tcExact}) ≥ +3.` };
    }
  }

  // 12. 16 vs 9: Stand if TC >= +5 (normally Hit)
  if (!playerInfo.isSoft && playerInfo.total === 16 && dealerUpcardKey === '9') {
    if (tc >= 5) {
      return { action: 'S', reason: `Count Deviation: Stand on 16 vs 9 because True Count (${tcExact}) ≥ +5.` };
    }
  }

  // 13. 13 vs 2: Stand if TC >= -1 (normally Stand, Hit if TC <= -2)
  if (!playerInfo.isSoft && playerInfo.total === 13 && dealerUpcardKey === '2') {
    if (tc <= -2) {
      return { action: 'H', reason: `Negative Count Deviation: Hit 13 vs 2 because True Count (${tcExact}) ≤ -2.` };
    }
  }

  // 14. 12 vs 4: Stand if TC >= 0 (Hit if TC <= -1)
  if (!playerInfo.isSoft && playerInfo.total === 12 && dealerUpcardKey === '4') {
    if (tc <= -1) {
      return { action: 'H', reason: `Negative Count Deviation: Hit 12 vs 4 because True Count (${tcExact}) ≤ -1.` };
    }
  }

  return null;
}

/**
 * Returns the optimal move and human-readable explanation
 */
export function getOptimalStrategy(cards, dealerCard, trueCount = { rounded: 0, floored: 0 }, canDouble = true, canSplit = false) {
  const playerInfo = evaluateHand(cards);
  if (playerInfo.isBust || playerInfo.total >= 21) {
    return { action: 'S', name: 'Stand', isDeviation: false, reason: 'Hand is 21 or bust.' };
  }

  const upcardKey = getDealerUpcardKey(dealerCard);

  // Check Illustrious 18 Deviations first
  const deviation = checkIllustrious18Deviation(playerInfo, upcardKey, trueCount);
  if (deviation) {
    let act = deviation.action;
    if (act === 'D' && !canDouble) act = 'H';
    if (act === 'P' && !canSplit) act = 'S';
    return {
      action: act,
      name: act === 'H' ? 'Hit' : (act === 'S' ? 'Stand' : (act === 'D' ? 'Double' : 'Split')),
      isDeviation: true,
      reason: deviation.reason
    };
  }

  let rawAction = 'H';
  let reason = '';

  // 1. Check Pairs (if splitting is eligible)
  if (playerInfo.isPair && canSplit) {
    let rankKey = cards[0].rank;
    if (['10', 'J', 'Q', 'K'].includes(rankKey)) rankKey = '10';
    if (BASIC_STRATEGY.pairs[rankKey]) {
      rawAction = BASIC_STRATEGY.pairs[rankKey][upcardKey] || 'H';
      reason = `Basic Strategy: Pair of ${cards[0].rank}s vs Dealer ${upcardKey}.`;
    }
  } 
  // 2. Soft Hands (Ace + X)
  else if (playerInfo.isSoft && cards.length === 2) {
    const nonAceCard = cards[0].rank === 'A' ? cards[1] : cards[0];
    let rankNum = parseInt(nonAceCard.rank, 10);
    if (['10', 'J', 'Q', 'K'].includes(nonAceCard.rank)) rankNum = 9; // Soft 20/21
    if (BASIC_STRATEGY.soft[rankNum]) {
      rawAction = BASIC_STRATEGY.soft[rankNum][upcardKey] || 'H';
      reason = `Basic Strategy: Soft ${playerInfo.total} (A,${nonAceCard.rank}) vs Dealer ${upcardKey}.`;
    }
  } 
  // 3. Hard Totals
  else {
    const totalKey = Math.min(21, Math.max(8, playerInfo.total));
    if (BASIC_STRATEGY.hard[totalKey]) {
      rawAction = BASIC_STRATEGY.hard[totalKey][upcardKey] || 'H';
      reason = `Basic Strategy: Hard ${playerInfo.total} vs Dealer ${upcardKey}.`;
    }
  }

  // Adjust for double restrictions (e.g. 3+ cards hand)
  let finalAction = rawAction;
  if (rawAction === 'D') {
    finalAction = canDouble ? 'D' : 'H';
  } else if (rawAction === 'Ds') {
    finalAction = canDouble ? 'D' : 'S';
  } else if (rawAction === 'P' && !canSplit) {
    // If pair can't be split anymore, fall back to hard total
    const totalKey = Math.min(21, Math.max(8, playerInfo.total));
    finalAction = BASIC_STRATEGY.hard[totalKey]?.[upcardKey] || 'H';
  }

  const names = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' };
  return {
    action: finalAction,
    name: names[finalAction] || 'Hit',
    isDeviation: false,
    reason
  };
}

/**
 * Betting Size Advisor based on True Count
 */
export function getBettingAdvice(trueCount, currentBet, minBet = 10, maxBet = 500) {
  const tc = trueCount.floored;
  const tcExact = trueCount.rounded;

  let unitMultiplier = 1;
  let status = 'neutral';
  let message = '';
  let subMessage = '';

  if (tc <= 1) {
    unitMultiplier = 1;
    status = tc < 0 ? 'negative' : 'neutral';
    if (tc < 0) {
      message = `Negative count (${tcExact}). Casino has the edge.`;
      subMessage = `Stick strictly to the table minimum ($${minBet}).`;
      if (currentBet > minBet) {
        message = `⚠️ Warning: True count is negative (${tcExact})!`;
        subMessage = `You should drop back to your minimum bet ($${minBet})!`;
      }
    } else {
      message = `Neutral count (${tcExact}). House holds a slight ~0.5% edge.`;
      subMessage = `Bet the table minimum ($${minBet}).`;
    }
  } else if (tc === 2) {
    unitMultiplier = 2;
    status = 'favorable';
    message = `Slight player edge (~+0.5%)! True Count: +${tcExact}.`;
    subMessage = `Ramp bet to 2x ($${minBet * 2}).`;
  } else if (tc === 3) {
    unitMultiplier = 4;
    status = 'favorable';
    message = `Strong player edge (~+1.0%)! True Count: +${tcExact}.`;
    subMessage = `Ramp bet to 4x ($${minBet * 4}).`;
  } else {
    // TC >= 4
    unitMultiplier = Math.min(8, 2 + (tc - 1) * 2);
    status = 'hot';
    message = `🔥 Hot shoe! High 10s & Aces concentration! True Count: +${tcExact}.`;
    subMessage = `Ramp bet to ${unitMultiplier}x ($${minBet * unitMultiplier}). Max spread recommended!`;
  }

  const recommendedBet = Math.min(maxBet, Math.max(minBet, minBet * unitMultiplier));

  return {
    trueCountExact: tcExact,
    trueCountFloor: tc,
    recommendedBet,
    unitMultiplier,
    status,
    message,
    subMessage
  };
}
