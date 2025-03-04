import ConfigStore from 'sentry/stores/configStore';

import trackMetric from 'getsentry/utils/trackMetric';

jest.unmock('getsentry/utils/trackMetric');

describe('trackMetric', function () {
  const eventName = 'my_event';
  const tags = {foo: 'bar'};
  beforeEach(function () {
    window.__initialData = {
      ...ConfigStore.getState(),
      sentryConfig: {
        ...ConfigStore.getState().sentryConfig,
        release: 'my_release',
      },
    };
    ConfigStore.set('enableAnalytics', true);
    window.ra = {metric: jest.fn()};
  });
  afterEach(function () {
    window.ra.metric.mockClear();
  });

  it('calls window.ra.metric with tags', function () {
    trackMetric(eventName, 24, tags);
    expect(window.ra.metric).toHaveBeenCalledWith(eventName, 24, {
      release: 'my_release',
      ...tags,
    });
  });
  it('enableAnalytics is false', function () {
    ConfigStore.set('enableAnalytics', false);
    trackMetric(eventName, 24, tags);
    expect(window.ra.metric).not.toHaveBeenCalled();
  });
});
