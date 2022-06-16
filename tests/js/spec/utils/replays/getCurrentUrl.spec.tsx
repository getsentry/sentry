import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {EventOrGroupType, EventTag, EventTransaction} from 'sentry/types/event';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

const START_DATE = new Date('2022-06-15T00:40:00.111Z');
const PAGELOAD_DATE = new Date('2022-06-15T00:45:00.222Z');
const NAVIGATION_DATE = new Date('2022-06-15T00:46:00.333Z');
const NEW_DOMAIN_DATE = new Date('2022-06-15T00:47:00.444Z');
const END_DATE = new Date('2022-06-15T00:50:00.555Z');

function getMockEvent(
  tags: EventTag[] = [
    {
      key: 'url',
      value: 'https://sourcemaps.io/#initial',
    },
  ]
): EventTransaction {
  return {
    id: '75abb7e4486145c89ed2ba1cfb09ca75',
    groupID: '3306973937',
    eventID: '75abb7e4486145c89ed2ba1cfb09ca75',
    projectID: '6301687',
    size: 2256,
    entries: [],
    dist: null,
    message: 'sentry-replay',
    title: 'sentry-replay',
    location: null,
    user: {
      id: undefined,
      email: undefined,
      username: null,
      ip_address: '192.168.1.1',
      name: null,
      data: null,
    },
    contexts: {
      device: {
        family: 'Mac',
        model: 'Mac',
        arch: 'arm64',
        type: 'device',
      },
      os: {
        build: '',
        kernel_version: '',
        name: 'Mac OS X',
        version: '10.15.7',
        type: 'os',
      },
      trace: {
        trace_id: 'c754974843f54982a21e6c77ac60c79c',
        span_id: 'bbe72f406dd56f3f',
        op: 'pageload',
        status: 'unknown',
        type: 'trace',
      },
    },
    sdk: {
      name: 'sentry.javascript.react',
      version: '6.19.3',
    },
    context: {},
    packages: {},
    type: EventOrGroupType.TRANSACTION,
    metadata: {
      title: 'sentry-replay',
    },
    tags,
    platform: 'javascript',
    dateReceived: '2022-06-15T13:45:53.488324Z',
    errors: [],
    crashFile: null,
    culprit: 'https://sourcemaps.io/',
    dateCreated: '2022-06-15T13:45:53.037000Z',
    fingerprints: ['c0b7a27a6a9c104af8ee03566480a165'],
    groupingConfig: {
      enhancements: 'eJybzDRxY3J-bm5-npWRgaGlroGxrpHxBABcYgcZ',
      id: 'newstyle:2019-10-29',
    },
    projectSlug: 'sourcemapsio-replays',
    startTimestamp: Number(START_DATE) / 1000,
    endTimestamp: Number(END_DATE) / 1000,
  };
}

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
  it('should return the url from tags when the offset is early', () => {
    const event = getMockEvent();
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB];
    const offsetMS = 0;
    const url = getCurrentUrl(event, crumbs, offsetMS);

    expect(url).toBe('https://sourcemaps.io/#initial');
  });

  it('should return the first navigation url when the offset is after that', () => {
    const event = getMockEvent();
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB];
    const offsetMS = Number(NAVIGATION_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(event, crumbs, offsetMS);

    expect(url).toBe(
      'https://sourcemaps.io/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js'
    );
  });

  it('should use the domain that is included in the crumb, if the crumb is a valid url', () => {
    const event = getMockEvent();
    const crumbs = [NEW_DOMAIN_CRUMB];
    const offsetMS = Number(NEW_DOMAIN_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(event, crumbs, offsetMS);

    expect(url).toBe('https://a062-174-94-6-155.ngrok.io/report/jquery.min.js');
  });
});
