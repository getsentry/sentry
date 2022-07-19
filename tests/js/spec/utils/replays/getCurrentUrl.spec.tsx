import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

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
  const event = TestStubs.Event({
    tags: [
      {
        key: 'url',
        value: 'https://sourcemaps.io/#initial',
      },
    ],
    startTimestamp: Number(START_DATE) / 1000,
    endTimestamp: Number(END_DATE) / 1000,
  });

  it('should return the url from tags when the offset is early', () => {
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB];
    const offsetMS = 0;
    const url = getCurrentUrl(event, crumbs, offsetMS);

    expect(url).toBe('https://sourcemaps.io/#initial');
  });

  it('should return the first navigation url when the offset is after that', () => {
    const crumbs = [PAGELOAD_CRUMB, NAV_CRUMB];
    const offsetMS = Number(NAVIGATION_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(event, crumbs, offsetMS);

    expect(url).toBe(
      'https://sourcemaps.io/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js'
    );
  });

  it('should use the domain that is included in the crumb, if the crumb is a valid url', () => {
    const crumbs = [NEW_DOMAIN_CRUMB];
    const offsetMS = Number(NEW_DOMAIN_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(event, crumbs, offsetMS);

    expect(url).toBe('https://a062-174-94-6-155.ngrok.io/report/jquery.min.js');
  });
});
