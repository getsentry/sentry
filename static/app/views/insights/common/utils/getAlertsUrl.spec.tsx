import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

describe('getAlertsUrl', () => {
  const {project} = initializeOrg();
  const pageFilters = PageFiltersFixture();
  it('should return a url to the alert rule page prepopulated with DB params', () => {
    const aggregate = 'avg(d:spans/duration@millisecond)';
    const query = 'span.category:db';
    const orgSlug = 'orgSlug';
    const url = getAlertsUrl({
      project,
      aggregate,
      query,
      organization: OrganizationFixture({slug: orgSlug}),
      pageFilters,
    });
    expect(url).toBe(
      '/organizations/orgSlug/monitors/new/settings?aggregate=avg%28d%3Aspans%2Fduration%40millisecond%29&dataset=transactions&detectorType=metric_issue&project=2&query=span.category%3Adb'
    );
  });
  it('should return a url to an EAP alert rule', () => {
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
      '/organizations/orgSlug/monitors/new/settings?aggregate=count%28span.duration%29&dataset=spans&detectorType=metric_issue&project=2&query=span.op%3Ahttp.client'
    );
  });
});
