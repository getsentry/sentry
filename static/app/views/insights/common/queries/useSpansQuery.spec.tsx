import {EventView} from 'sentry/utils/discover/eventView';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

function makeEventView(range: {end?: string; range?: string; start?: string}) {
  return EventView.fromSavedQuery({
    id: undefined,
    name: '',
    fields: ['count()'],
    version: 2,
    ...range,
  });
}

describe('getStaleTimeForEventView', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-10T22:05:00Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns 0 when the absolute range ends in the future', () => {
    const eventView = makeEventView({
      start: '2026-10-10T21:56:00',
      end: '2026-10-10T22:10:00',
    });

    expect(getStaleTimeForEventView(eventView)).toBe(0);
  });

  it('returns Infinity when the absolute range ended in the past', () => {
    const eventView = makeEventView({
      start: '2026-10-10T21:46:00',
      end: '2026-10-10T22:00:00',
    });

    expect(getStaleTimeForEventView(eventView)).toBe(Infinity);
  });

  it('returns 0 when the range is a short relative period', () => {
    const eventView = makeEventView({range: '15m'});

    expect(getStaleTimeForEventView(eventView)).toBe(0);
  });
});
