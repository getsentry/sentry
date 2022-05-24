import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import ReplayReader from 'sentry/utils/replays/replayReader';

import {
  createEventTransaction,
  createReplayEvents,
  createRrWebEvents,
} from './mocks/events.fixture';

function createReplay(): ReplayReader | null {
  return ReplayReader.factory(
    createEventTransaction(),
    createRrWebEvents(),
    createReplayEvents()
  );
}

describe('getCurrentUrl', () => {
  it('should return the current url given a replay', () => {
    const replay = createReplay() as ReplayReader;
    expect(getCurrentUrl(replay, 0)).toBe('https://sourcemaps.io/');
  });

  it('should return a different url when time changes and it is after a Navigation action occurs on the fixture', () => {
    const timeAfterNavigationEventOccursMs = 55114;
    const replay = createReplay() as ReplayReader;
    expect(getCurrentUrl(replay, timeAfterNavigationEventOccursMs)).toBe(
      'https://sourcemaps.io/report/newUrl'
    );
  });

  it('should return the current url if the currentTime is not after the first navigation event', () => {
    const timeBeforeFirstNavigationEventMs = 26000;
    const replay = createReplay() as ReplayReader;
    expect(getCurrentUrl(replay, timeBeforeFirstNavigationEventMs)).toBe(
      'https://sourcemaps.io/'
    );
  });

  it('should return the first navigation Url if current time is between two navigation events', () => {
    const timeBetweenNavigationEventsMs = 56080;
    const replay = createReplay() as ReplayReader;
    expect(getCurrentUrl(replay, timeBetweenNavigationEventsMs)).toBe(
      'https://sourcemaps.io/report/newUrl'
    );
  });

  it('should return the last url if current time is after all navigation events', () => {
    const timeBetweenNavigationEventsMs = 162080;
    const replay = createReplay() as ReplayReader;
    expect(getCurrentUrl(replay, timeBetweenNavigationEventsMs)).toBe(
      'https://sourcemaps.io/report/newUrl/4'
    );
  });

  it('should return the last url if two navigation events happens at the same time', () => {
    const timeBetweenNavigationEventsMs = 162080;
    const replay = createReplay() as ReplayReader;
    expect(getCurrentUrl(replay, timeBetweenNavigationEventsMs)).toBe(
      'https://sourcemaps.io/report/newUrl/4'
    );
  });
});
