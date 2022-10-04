import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';

describe('getDiscoverLandingUrl', function () {
  it('is correct for with discover-query and discover-basic features', function () {
    const org = TestStubs.Organization({features: ['discover-query', 'discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/queries/');
  });

  it('is correct for with only discover-basic feature', function () {
    const org = TestStubs.Organization({features: ['discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/results/');
  });

  it('navigates to the results URL with the discover-query-builder-as-landing-page feature', function () {
    const org = TestStubs.Organization({
      features: ['discover-query', 'discover-query-builder-as-landing-page'],
    });
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/homepage/');
  });
});
