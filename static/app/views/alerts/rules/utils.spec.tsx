import {MetricRuleFixture} from 'sentry-fixture/metricRule';

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
      orgSlug: 'slug',
      period: '7d',
      projectId: '1',
    });
    expect(url).toBe(
      '/organizations/slug/traces/?dataset=spansRpc&environment=prod&interval=30m&project=1&query=span.op%3Ahttp.client&statsPeriod=7d&visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22p75%28span.duration%29%22%5D%7D'
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
      orgSlug: 'slug',
      period: '9998m',
      projectId: '1',
    });
    expect(url).toBe(
      '/organizations/slug/traces/?dataset=spansRpc&environment=prod&interval=30m&project=1&query=span.op%3Ahttp.client&statsPeriod=7d&visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22p75%28span.duration%29%22%5D%7D'
    );
  });
});
