import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {getMetricMonitorUrl} from 'sentry/views/insights/common/utils/getMetricMonitorUrl';

describe('getMetricMonitorUrl', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({id: '123'});

  it('errors count', () => {
    const url = getMetricMonitorUrl({
      aggregate: 'count()',
      dataset: Dataset.ERRORS,
      organization,
      project,
      query: 'is:unresolved',
    });

    expect(url).toEqual({
      pathname: '/organizations/org-slug/monitors/new/settings',
      query: {
        detectorType: 'metric_issue',
        project: '123',
        dataset: DetectorDataset.ERRORS,
        aggregate: 'count()',
        environment: undefined,
        query: 'is:unresolved',
        name: undefined,
        referrer: undefined,
      },
    });
  });

  it('uses spans detector dataset for EAP spans count', () => {
    const url = getMetricMonitorUrl({
      aggregate: 'count(span.duration)',
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      organization,
      project,
      query: 'span.op:http.client',
    });

    expect(url.pathname).toBe('/organizations/org-slug/monitors/new/settings');
    expect(url.query.dataset).toBe(DetectorDataset.SPANS);
  });

  it('uses logs detector dataset for EAP logs count', () => {
    const url = getMetricMonitorUrl({
      aggregate: 'count()',
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      organization,
      project,
      query: 'event.type:trace_item_log',
      eventTypes: [EventTypes.TRACE_ITEM_LOG],
    });

    expect(url.pathname).toBe('/organizations/org-slug/monitors/new/settings');
    expect(url.query.dataset).toBe(DetectorDataset.LOGS);
  });

  it('uses metrics detector dataset for EAP metrics', () => {
    const url = getMetricMonitorUrl({
      aggregate: 'count()',
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      eventTypes: [EventTypes.TRACE_ITEM_METRIC],
      organization,
      project,
    });

    expect(url.pathname).toBe('/organizations/org-slug/monitors/new/settings');
    expect(url.query.dataset).toBe(DetectorDataset.METRICS);
  });

  it('uses releases detector dataset for metrics dataset', () => {
    const url = getMetricMonitorUrl({
      aggregate: 'count()',
      dataset: Dataset.METRICS,
      organization,
      project,
    });

    expect(url.pathname).toBe('/organizations/org-slug/monitors/new/settings');
    expect(url.query.dataset).toBe(DetectorDataset.RELEASES);
  });
});
