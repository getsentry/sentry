import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Dataset, TimeWindow} from 'sentry/views/alerts/rules/metric/types';
import {getAlertRuleExploreUrl} from 'sentry/views/alerts/rules/utils';

describe('getExploreUrl', () => {
  it('should return the correct url', () => {
    const rule = MetricRuleFixture();
    rule.dataset = Dataset.EVENTS_ANALYTICS_PLATFORM;
    rule.timeWindow = TimeWindow.THIRTY_MINUTES;
    rule.aggregate = 'p75(span.duration)';
    rule.query = 'span.op:http.client';
    rule.environment = 'prod';
    const url = getAlertRuleExploreUrl({
      rule,
      organization: OrganizationFixture({slug: 'slug'}),
      timePeriod: {
        period: '7d',
        usingPeriod: true,
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        display: '',
        label: '',
      },
      projectId: '1',
    });
    expect(url).toBe(
      '/organizations/slug/traces/?environment=prod&interval=30m&project=1&query=span.op%3Ahttp.client&statsPeriod=7d&visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22p75%28span.duration%29%22%5D%7D'
    );
  });
  it('should return the correct url for 9998m', () => {
    const rule = MetricRuleFixture();
    rule.dataset = Dataset.EVENTS_ANALYTICS_PLATFORM;
    rule.timeWindow = TimeWindow.THIRTY_MINUTES;
    rule.aggregate = 'p75(span.duration)';
    rule.query = 'span.op:http.client';
    rule.environment = 'prod';
    const url = getAlertRuleExploreUrl({
      rule,
      organization: OrganizationFixture({slug: 'slug'}),
      timePeriod: {
        period: '7d',
        usingPeriod: true,
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        display: '',
        label: '',
      },
      projectId: '1',
    });
    expect(url).toBe(
      '/organizations/slug/traces/?environment=prod&interval=30m&project=1&query=span.op%3Ahttp.client&statsPeriod=7d&visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22p75%28span.duration%29%22%5D%7D'
    );
  });
  it('should respect custom time ranges', () => {
    const rule = MetricRuleFixture();
    rule.dataset = Dataset.EVENTS_ANALYTICS_PLATFORM;
    rule.timeWindow = TimeWindow.THIRTY_MINUTES;
    rule.aggregate = 'p75(span.duration)';
    rule.query = 'span.op:http.client';
    rule.environment = 'prod';
    const start = new Date('2017-10-12T12:00:00.000Z').toISOString();
    const end = new Date('2017-10-19T12:00:00.000Z').toISOString();
    const url = getAlertRuleExploreUrl({
      rule,
      organization: OrganizationFixture({slug: 'slug'}),
      timePeriod: {
        period: '7d',
        usingPeriod: false,
        start,
        end,
        display: '',
        label: '',
      },
      projectId: '1',
    });
    expect(url).toBe(
      '/organizations/slug/traces/?end=2017-10-19T12%3A00%3A00.000Z&environment=prod&interval=30m&project=1&query=span.op%3Ahttp.client&start=2017-10-12T12%3A00%3A00.000Z&visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22p75%28span.duration%29%22%5D%7D'
    );
  });
});
