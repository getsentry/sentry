import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {Dataset} from 'sentry/views/alerts/rules/metric/types';
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
      organization: OrganizationFixture({slug: orgSlug}),
      pageFilters,
    });
    expect(url).toBe(
      '/organizations/orgSlug/alerts/new/metric/?aggregate=avg%28d%3Aspans%2Fduration%40millisecond%29&dataset=generic_metrics&eventTypes=transaction&interval=1h&project=project-slug&query=span.module%3Adb&statsPeriod=7d'
    );
  });
  it('should return a url to an EAP alert rule', function () {
    const aggregate = 'count(span.duration)';
    const query = 'span.op:http.client';
    const orgSlug = 'orgSlug';
    const url = getAlertsUrl({
      project,
      aggregate,
      query,
      organization: OrganizationFixture({slug: orgSlug}),
      pageFilters,
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
    });
    expect(url).toBe(
      '/organizations/orgSlug/alerts/new/metric/?aggregate=count%28span.duration%29&dataset=events_analytics_platform&eventTypes=transaction&interval=1h&project=project-slug&query=span.op%3Ahttp.client&statsPeriod=7d'
    );
  });
});
