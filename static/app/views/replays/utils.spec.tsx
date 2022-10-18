import {getInitialTimeOffset} from 'sentry/views/replays/utils';

describe('getInitialTimeOffset', () => {
  it('should return the initialTimeOffset if provided', () => {
    expect(
      getInitialTimeOffset({
        initialTimeOffset: 123,
        eventTimestamp: '1666047045297',
        startTimestampMs: 1666047046000,
      })
    ).toBe(123);
  });

  it('should return 0 if no required params are provided', () => {
    expect(getInitialTimeOffset({startTimestampMs: 1666047046000})).toBe(0);

    expect(getInitialTimeOffset({})).toBe(0);

    expect(getInitialTimeOffset({eventTimestamp: '1666047045297'})).toBe(0);
  });

  it('should return 0 if the eventTimestamp is not the correct format', () => {
    expect(getInitialTimeOffset({eventTimestamp: '123'})).toBe(0);
  });

  it('should return 0 if the eventTimestamp is not within the range of the replay', () => {
    expect(
      getInitialTimeOffset({
        eventTimestamp: '1666047045297',
        startTimestampMs: 1666047046000,
      })
    ).toBe(0);
  });

  it('should return the correct initialTimeOffset if the eventTimestamp is within the range of the replay', () => {
    expect(
      getInitialTimeOffset({
        eventTimestamp: '1666047046000',
        startTimestampMs: 1666047045000,
      })
    ).toBe(1);
  });

  it('should return the correct initialTimeOffset if the eventTimestamp is the correct format', () => {
    expect(
      getInitialTimeOffset({
        eventTimestamp: '1666047045297',
        startTimestampMs: 1666047045000,
      })
    ).toBe(0.297);

    expect(
      getInitialTimeOffset({
        eventTimestamp: '2022-10-17T22:50:46.000Z',
        startTimestampMs: 1666047045000,
      })
    ).toBe(1);
  });
});
