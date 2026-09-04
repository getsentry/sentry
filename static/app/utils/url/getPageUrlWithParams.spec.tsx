import {LocationFixture} from 'sentry-fixture/locationFixture';

import {getPageUrlWithParams} from 'sentry/utils/url/getPageUrlWithParams';

describe('getPageUrlWithParams', () => {
  it('returns an absolute URL with the edited params when given a location', () => {
    const url = getPageUrlWithParams(
      LocationFixture({
        pathname: '/organizations/org-slug/explore/logs/',
        search: '?a=1&b=2',
      }),
      params => {
        params.delete('a');
        params.set('c', '3');
      }
    );

    expect(url).toBe('http://localhost/organizations/org-slug/explore/logs/?b=2&c=3');
  });
});
