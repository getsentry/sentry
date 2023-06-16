import {BreadcrumbLevelType, BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {
  getNextReplayEvent,
  getPrevReplayEvent,
} from 'sentry/utils/replays/getReplayEvent';

const START_TIMESTAMP_SEC = 1651693622.951;
const CURRENT_TIME_MS = 15000;

function createCrumbs(): Crumb[] {
  return [
    {
      color: 'gray300',
      data: {url: 'https://dev.getsentry.net:7999/organizations/sentry/performance/'},
      description: 'Default',
      id: 0,
      level: BreadcrumbLevelType.INFO,
      message: 'Start recording',
      timestamp: '2022-05-11T22:41:32.002Z',
      type: BreadcrumbType.INIT,
    },
    {
      category: 'ui.click',
      color: 'purple300',
      data: undefined,
      description: 'User Action',
      event_id: null,
      id: 3,
      level: BreadcrumbLevelType.INFO,
      message: 'div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input',
      timestamp: '2022-05-04T19:47:08.085000Z',
      type: BreadcrumbType.UI,
    },
    {
      category: 'ui.input',
      color: 'purple300',
      data: undefined,
      description: 'User Action',
      event_id: null,
      id: 4,
      level: BreadcrumbLevelType.INFO,
      message: 'div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input',
      timestamp: '2022-05-04T19:47:11.086000Z',
      type: BreadcrumbType.UI,
    },
    {
      category: 'ui.click',
      color: 'purple300',
      data: undefined,
      description: 'User Action',
      event_id: null,
      id: 20,
      level: BreadcrumbLevelType.INFO,
      message: 'div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input',
      timestamp: '2022-05-04T19:47:52.915000Z',
      type: BreadcrumbType.UI,
    },
    {
      category: 'navigation',
      color: 'green300',
      data: {
        from: '/organizations/sentry/user-feedback/?project=6380506',
        to: '/organizations/sentry/issues/',
      },
      description: 'Navigation',
      event_id: null,
      id: 166,
      level: BreadcrumbLevelType.INFO,
      message: undefined,
      timestamp: '2022-05-04T19:47:59.915000Z',
      type: BreadcrumbType.NAVIGATION,
    },
  ];
}

describe('getNextReplayEvent', () => {
  it('should return the next crumb', () => {
    const crumbs = createCrumbs();
    const results = getNextReplayEvent({
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + CURRENT_TIME_MS,
    });

    expect(results?.id).toEqual(20);
  });

  it('should return the next crumb when the the list is not sorted', () => {
    const [one, two, three, four, five] = createCrumbs();
    const results = getNextReplayEvent({
      items: [one, four, five, three, two],
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + CURRENT_TIME_MS,
    });

    expect(results?.id).toEqual(20);
  });

  it('should return undefined when there are no crumbs', () => {
    const crumbs = [];
    const results = getNextReplayEvent({
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + CURRENT_TIME_MS,
    });

    expect(results).toBeUndefined();
  });

  it('should return undefined when the timestamp is later than any crumbs', () => {
    const crumbs = createCrumbs();
    const results = getNextReplayEvent({
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + 99999999999,
    });

    expect(results).toBeUndefined();
  });

  it('should return the crumb after when a timestamp exactly matches', () => {
    const crumbs = createCrumbs();
    const exactCrumbTime = 8135;
    const results = getNextReplayEvent({
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + exactCrumbTime,
    });

    expect(results?.id).toEqual(20);
  });

  it('should return the crumb if timestamps exactly match and allowMatch is enabled', () => {
    const crumbs = createCrumbs();
    const exactCrumbTime = 8135;
    const results = getNextReplayEvent({
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + exactCrumbTime,
    });

    expect(results?.id).toEqual(20);
  });
});

describe('getPrevReplayEvent', () => {
  it('should return the previous crumb even if the timestamp is closer to the next crumb', () => {
    const crumbs = createCrumbs();
    const results = getPrevReplayEvent({
      itemLookup: crumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + CURRENT_TIME_MS,
    });

    expect(results?.id).toEqual(4);
  });

  it('should return the previous crumb when the list is not sorted', () => {
    const [one, two, three, four, five] = createCrumbs();
    const items = [one, four, five, three, two];
    const results = getPrevReplayEvent({
      itemLookup: items
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + CURRENT_TIME_MS,
    });

    expect(results?.id).toEqual(4);
  });

  it('should return undefined when there are no crumbs', () => {
    const crumbs = [];
    const results = getPrevReplayEvent({
      itemLookup: crumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + CURRENT_TIME_MS,
    });

    expect(results).toBeUndefined();
  });

  it('should return undefined when the timestamp is earlier than any crumbs', () => {
    const crumbs = createCrumbs();
    const results = getPrevReplayEvent({
      itemLookup: crumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 - CURRENT_TIME_MS,
    });

    expect(results).toBeUndefined();
  });

  it('should return the last crumb if timestamp is later than any crumb', () => {
    const crumbs = createCrumbs();
    const results = getPrevReplayEvent({
      itemLookup: crumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items: crumbs,
      targetTimestampMs: 1652308892002 + 10,
    });

    expect(results?.id).toEqual(0);
  });

  it('should return the last crumb if timestamp is exactly the last crumb', () => {
    const crumbs = createCrumbs();
    const results = getPrevReplayEvent({
      itemLookup: crumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items: crumbs,
      targetTimestampMs: 1652308892002,
    });

    expect(results?.id).toEqual(0);
  });

  it('should return the crumb if timestamps exactly match', () => {
    const crumbs = createCrumbs();
    const exactCrumbTime = 8135;
    const results = getPrevReplayEvent({
      itemLookup: crumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
      items: crumbs,
      targetTimestampMs: START_TIMESTAMP_SEC * 1000 + exactCrumbTime,
    });

    expect(results?.id).toEqual(4);
  });
});
