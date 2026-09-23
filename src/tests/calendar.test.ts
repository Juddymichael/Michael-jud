import { describe, it, expect } from 'vitest';
import {
  buildMonthCalendar,
  getTradeDateKey,
  getCalendarDateKey,
  DEFAULT_CALENDAR_TIMEZONE,
} from '../lib/calendar';
import { Trade } from '../types/trade';

function mockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: `trade_${Math.random().toString(36).slice(2, 9)}`,
    ticket: '1001',
    sourceId: 'src_test',
    openedAt: '2026-09-01T10:00:00.000Z',
    closedAt: '2026-09-01T11:00:00.000Z',
    timezone: 'UTC',
    symbol: 'EURUSD',
    direction: 'BUY',
    status: 'CLOSED',
    entryPrice: 1.085,
    exitPrice: 1.09,
    stopLoss: 1.08,
    takeProfit: 1.095,
    quantity: 1,
    lotSize: 1,
    contractSize: 100000,
    grossPnL: 100,
    commission: 0,
    swap: 0,
    netPnL: 100,
    initialRiskAmount: 50,
    riskPercent: 0.5,
    rMultiple: 2.0,
    balanceBefore: 10000,
    balanceAfter: 10100,
    session: 'LONDON',
    timeframe: 'M15',
    setup: 'FVG',
    notes: null,
    emotion: 'DISCIPLINED',
    mistake: 'NONE',
    tags: [],
    screenshotBefore: null,
    screenshotAfter: null,
    dataQuality: 'VERIFIED',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('Trading Calendar Alignment & Performance Calculations', () => {
  it('Point 1: Sep 1, 2026 falls on Tuesday, preceded by Aug 31 on Monday', () => {
    const calendar = buildMonthCalendar(2026, 8, []); // month index 8 = September
    const firstWeek = calendar.weeks[0];

    expect(firstWeek.days).toHaveLength(7);

    // Day 0 = Monday (Aug 31, previous month)
    expect(firstWeek.days[0].dayNumber).toBe(31);
    expect(firstWeek.days[0].isCurrentMonth).toBe(false);
    expect(firstWeek.days[0].dateStr).toBe('2026-08-31');

    // Day 1 = Tuesday (Sep 1, current month)
    expect(firstWeek.days[1].dayNumber).toBe(1);
    expect(firstWeek.days[1].isCurrentMonth).toBe(true);
    expect(firstWeek.days[1].dateStr).toBe('2026-09-01');

    // Day 2 = Wednesday (Sep 2)
    expect(firstWeek.days[2].dayNumber).toBe(2);
    expect(firstWeek.days[2].isCurrentMonth).toBe(true);
    expect(firstWeek.days[2].dateStr).toBe('2026-09-02');
  });

  it('Point 2: Previous and next month padding days are correctly computed', () => {
    const calendar = buildMonthCalendar(2026, 8, []); // September 2026
    const weeks = calendar.weeks;

    // First week Monday is 31 August
    expect(weeks[0].days[0].dayNumber).toBe(31);
    expect(weeks[0].days[0].isCurrentMonth).toBe(false);

    // Last day of September is 30 (Wednesday)
    // Next padding days are 1, 2, 3, 4 October (Thursday to Sunday)
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek.days[2].dayNumber).toBe(30); // Wednesday Sep 30
    expect(lastWeek.days[2].isCurrentMonth).toBe(true);

    expect(lastWeek.days[3].dayNumber).toBe(1); // Thursday Oct 1
    expect(lastWeek.days[3].isCurrentMonth).toBe(false);
    expect(lastWeek.days[3].dateStr).toBe('2026-10-01');

    expect(lastWeek.days[6].dayNumber).toBe(4); // Sunday Oct 4
    expect(lastWeek.days[6].isCurrentMonth).toBe(false);
    expect(lastWeek.days[6].dateStr).toBe('2026-10-04');
  });

  it('Point 3: Weekend trades (Saturday & Sunday) are faithfully retained and not shifted', () => {
    // Saturday Sep 5, 2026 trade
    const satTrade = mockTrade({
      closedAt: '2026-09-05T14:00:00.000Z',
      netPnL: 150,
    });
    // Sunday Sep 6, 2026 trade
    const sunTrade = mockTrade({
      closedAt: '2026-09-06T19:00:00.000Z',
      netPnL: -50,
    });

    expect(getTradeDateKey(satTrade)).toBe('2026-09-05');
    expect(getTradeDateKey(sunTrade)).toBe('2026-09-06');

    const calendar = buildMonthCalendar(2026, 8, [satTrade, sunTrade]);
    const firstWeek = calendar.weeks[0];

    // Saturday is day index 5
    expect(firstWeek.days[5].dateStr).toBe('2026-09-05');
    expect(firstWeek.days[5].tradeCount).toBe(1);
    expect(firstWeek.days[5].netPnL).toBe(150);

    // Sunday is day index 6
    expect(firstWeek.days[6].dateStr).toBe('2026-09-06');
    expect(firstWeek.days[6].tradeCount).toBe(1);
    expect(firstWeek.days[6].netPnL).toBe(-50);
  });

  it('Point 4: Week summary column strictly excludes adjacent month trades (e.g. Aug 31 vs Sep 1)', () => {
    // User scenario: Aug 31 trade (+626.97) and Sep 1 trade (+530.91)
    const aug31Trade = mockTrade({
      ticket: 'aug_31',
      closedAt: '2026-08-31T14:00:00.000Z',
      netPnL: 626.97,
    });
    const sep1Trade = mockTrade({
      ticket: 'sep_1',
      closedAt: '2026-09-01T10:00:00.000Z',
      netPnL: 530.91,
    });
    const sep2Trade = mockTrade({
      ticket: 'sep_2',
      closedAt: '2026-09-02T10:00:00.000Z',
      netPnL: -106.95,
    });

    const calendar = buildMonthCalendar(2026, 8, [aug31Trade, sep1Trade, sep2Trade]);
    const week1 = calendar.weeks[0];

    // Week 1 must ONLY accumulate September trades!
    // It must NOT include the 626.97 of Aug 31!
    expect(week1.totalTrades).toBe(2);
    expect(week1.netPnL).toBe(Math.round((530.91 - 106.95) * 100) / 100);
    expect(week1.winningTrades).toBe(1);
    expect(week1.losingTrades).toBe(1);
    expect(week1.winRate).toBe(50.0);
  });

  it('Point 5: Cross-check verification: sum of all weeks equals exactly month summary', () => {
    // Dataset including trades in August, September (across multiple weeks), and October
    const trades: Trade[] = [
      // August 31 (should be excluded from Sep weeks)
      mockTrade({ closedAt: '2026-08-31T12:00:00.000Z', netPnL: 626.97 }),
      // Sep Week 1 (Sep 1 to 4)
      mockTrade({ closedAt: '2026-09-01T10:00:00.000Z', netPnL: 530.91 }),
      mockTrade({ closedAt: '2026-09-02T11:00:00.000Z', netPnL: -106.95 }),
      mockTrade({ closedAt: '2026-09-03T14:00:00.000Z', netPnL: 145.51 }),
      mockTrade({ closedAt: '2026-09-04T15:00:00.000Z', netPnL: -35.23 }),
      // Sep Week 2 (Sep 7 to 11)
      mockTrade({ closedAt: '2026-09-07T09:00:00.000Z', netPnL: 200.0 }),
      mockTrade({ closedAt: '2026-09-09T14:00:00.000Z', netPnL: -50.0 }),
      // Sep Week 5 (Sep 29 and 30)
      mockTrade({ closedAt: '2026-09-30T10:00:00.000Z', netPnL: 80.0 }),
      // October 1 (should be excluded from Sep weeks)
      mockTrade({ closedAt: '2026-10-01T10:00:00.000Z', netPnL: 150.0 }),
    ];

    const calendar = buildMonthCalendar(2026, 8, trades);

    const sumWeekPnL = Math.round(
      calendar.weeks.reduce((acc, w) => acc + w.netPnL, 0) * 100
    ) / 100;
    const sumWeekTrades = calendar.weeks.reduce((acc, w) => acc + w.totalTrades, 0);
    const sumWeekWins = calendar.weeks.reduce((acc, w) => acc + w.winningTrades, 0);
    const sumWeekLosses = calendar.weeks.reduce((acc, w) => acc + w.losingTrades, 0);

    // Strict cross-check equivalence
    expect(sumWeekPnL).toBe(calendar.netPnL);
    expect(sumWeekTrades).toBe(calendar.totalTrades);
    expect(sumWeekWins).toBe(calendar.winningTrades);
    expect(sumWeekLosses).toBe(calendar.losingTrades);

    // Exact count of September trades: 7 trades
    expect(calendar.totalTrades).toBe(7);
    // Exact net PnL of September: 530.91 - 106.95 + 145.51 - 35.23 + 200 - 50 + 80 = 764.24
    expect(calendar.netPnL).toBe(764.24);
  });
});
