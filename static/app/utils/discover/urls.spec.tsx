import {OrganizationFixture} from 'sentry-fixture/organization';

import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';

describe('getDiscoverLandingUrl', () => {
  it('is correct for with discover-query and discover-basic features', () => {
    const org = OrganizationFixture({features: ['discover-query', 'discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe(
      '/organizations/org-slug/explore/discover/homepage/'
    );
  });

  it('is correct for with only discover-basic feature', () => {
    const org = OrganizationFixture({features: ['discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe(
      '/organizations/org-slug/explore/discover/results/'
    );
  });
});
