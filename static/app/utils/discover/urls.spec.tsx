import {Organization} from 'sentry-fixture/organization';

import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';

describe('getDiscoverLandingUrl', function () {
  it('is correct for with discover-query and discover-basic features', function () {
    const org = Organization({features: ['discover-query', 'discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/homepage/');
  });

  it('is correct for with only discover-basic feature', function () {
    const org = Organization({features: ['discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/results/');
  });
});
