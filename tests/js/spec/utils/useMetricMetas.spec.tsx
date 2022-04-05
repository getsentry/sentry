import {render, screen} from 'sentry-test/reactTestingLibrary';

import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import {useMetricMetas} from 'sentry/utils/useMetricMetas';

function TestComponent({other}: {other: string}) {
  const {metricMetas} = useMetricMetas();
  return (
    <div>
      <span>{other}</span>
      {metricMetas &&
        Object.entries(metricMetas).map(([key, meta]) => <em key={key}>{meta.name}</em>)}
    </div>
  );
}

describe('useMetricMetas', function () {
  it('works', async function () {
    const organization = TestStubs.Organization();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/meta/`,
      body: [
        {
          name: 'sentry.sessions.session',
          type: 'counter',
          operations: ['sum'],
        },
        {
          name: 'sentry.sessions.session.error',
          type: 'set',
          operations: ['count_unique'],
        },
      ],
    });

    jest.spyOn(MetricsMetaStore, 'trigger');

    render(<TestComponent other="value" />, {organization});

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(MetricsMetaStore.trigger).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('sentry.sessions.session')).toBeInTheDocument();
    expect(screen.getByText('sentry.sessions.session.error')).toBeInTheDocument();
  });
});
