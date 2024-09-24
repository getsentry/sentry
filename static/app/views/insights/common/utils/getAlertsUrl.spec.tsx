import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

describe('getAlertsUrl', function () {
  const {project} = initializeOrg();
  const pageFilters = PageFiltersFixture();
  it('should return a url to the alert rule page prepopulated with DB params', function () {
    const aggregate = 'avg(d:spans/duration@millisecond)';
    const query = 'span.module:db';
    const orgSlug = 'orgSlug';
    const url = getAlertsUrl({
      project,
      aggregate,
      query,
      orgSlug,
      pageFilters,
    });
    expect(url).toEqual(
      '/organizations/orgSlug/alerts/new/metric/?aggregate=avg%28d%3Aspans%2Fduration%40millisecond%29&dataset=generic_metrics&eventTypes=transaction&project=project-slug&query=span.module%3Adb&statsPeriod=7d'
    );
  });
});
