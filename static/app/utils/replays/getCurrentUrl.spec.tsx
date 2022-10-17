import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import type {ReplayRecord} from 'sentry/views/replays/types';

const START_DATE = new Date('2022-06-15T00:40:00.111Z');
const PAGELOAD_DATE = new Date('2022-06-15T00:45:00.222Z');
const NAVIGATION_DATE = new Date('2022-06-15T00:46:00.333Z');
const NEW_DOMAIN_DATE = new Date('2022-06-15T00:47:00.444Z');
const END_DATE = new Date('2022-06-15T00:50:00.555Z');

const PAGELOAD_CRUMB: Crumb = {
  category: 'default',
  type: BreadcrumbType.NAVIGATION,
  timestamp: PAGELOAD_DATE.toISOString(),
  level: BreadcrumbLevelType.INFO,
  message: 'https://sourcemaps.io/',
  data: {
    to: 'https://sourcemaps.io/',
  },
  id: 6,
  color: 'green300',
  description: 'Navigation',
};

const NAV_CRUMB: Crumb = {
  type: BreadcrumbType.NAVIGATION,
  category: 'navigation',
  data: {
    from: '/',
    to: '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
  },
  timestamp: NAVIGATION_DATE.toISOString(),
  id: 5,
  color: 'green300',
  description: 'Navigation',
  level: BreadcrumbLevelType.UNDEFINED,
};

const NEW_DOMAIN_CRUMB: Crumb = {
  category: 'default',
  type: BreadcrumbType.NAVIGATION,
  timestamp: NEW_DOMAIN_DATE.toISOString(),
  level: BreadcrumbLevelType.INFO,
  message: 'https://a062-174-94-6-155.ngrok.io/report/jquery.min.js',
  data: {
    to: 'https://a062-174-94-6-155.ngrok.io/report/jquery.min.js',
  },
  id: 29,
  color: 'green300',
  description: 'Navigation',
};

describe('getCurrentUrl', () => {
  let replayRecord;
  beforeEach(() => {
    replayRecord = TestStubs.Event({
      tags: {},
      urls: [
        'https://sourcemaps.io/#initial',
        'https://sourcemaps.io/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
        'https://a062-174-94-6-155.ngrok.io/report/jquery.min.js',
      ],
      startedAt: START_DATE,
      finishedAt: END_DATE,
    }) as ReplayRecord;
  });

  it('should return the origin of the first url from the url array if the offset is early', () => {
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB];
    const offsetMS = 0;
    const url = getCurrentUrl(replayRecord, crumbs, offsetMS);

    expect(url).toBe('https://sourcemaps.io');
  });

  it('should return the first navigation url when the offset is after that', () => {
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB];
    const offsetMS = Number(NAVIGATION_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(replayRecord, crumbs, offsetMS);

    expect(url).toBe(
      'https://sourcemaps.io/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js'
    );
  });

  it('should use the domain that is included in the crumb, if the crumb is a valid url', () => {
    const crumbs = [NEW_DOMAIN_CRUMB];
    const offsetMS = Number(NEW_DOMAIN_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(replayRecord, crumbs, offsetMS);

    expect(url).toBe('https://a062-174-94-6-155.ngrok.io/report/jquery.min.js');
  });

  it('should not explode when an invalid urls is found', () => {
    const base64EncodedScriptTag =
      'nulltext/html;base64,PHNjcmlwdD4KICAgICAgb25tZXNzYWdlID0gKGV2ZW50KSA9PiB7CiAgICAgICAgY29uc29sZS5sb2coJ2hlbGxvIHdvcmxkJyk7CiAgICAgIH0KICA8L3NjcmlwdD4=';
    replayRecord.urls = [base64EncodedScriptTag];
    const crumbs = [];
    const offsetMS = 0;
    const url = getCurrentUrl(replayRecord, crumbs, offsetMS);

    expect(url).toBe(base64EncodedScriptTag);
  });
});
