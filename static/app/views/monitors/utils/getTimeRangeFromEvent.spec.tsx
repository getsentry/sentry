import {Event as EventFixture} from 'sentry-fixture/event';

import {getTimeRangeFromEvent} from './getTimeRangeFromEvent';

describe('getTimeRangeFromEvent', function () {
  it('correctly creates a centered 24h time window', function () {
    const event = EventFixture({dateReceived: '2023-07-26T09:00:00Z'});
    const now = new Date('2023-07-27T11:00:00Z');

    const {start, end} = getTimeRangeFromEvent(event, now, '24h');

    expect(start).toEqual(new Date('2023-07-25T21:00:00Z'));
    expect(end).toEqual(new Date('2023-07-26T21:00:00Z'));
  });

  it('falls back to last 24h if the event cannot be centered', function () {
    const event = EventFixture({dateReceived: '2023-07-27T09:00:00Z'});
    const now = new Date('2023-07-27T11:00:00Z');

    const {start, end} = getTimeRangeFromEvent(event, now, '24h');

    expect(start).toEqual(new Date('2023-07-26T11:00:00Z'));
    expect(end).toEqual(new Date('2023-07-27T11:00:00Z'));
  });
});
