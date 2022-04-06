import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricsProvider} from 'sentry/utils/metrics/metricsContext';
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
  const {organization, project} = initializeOrg();
  let metricsTagsMock: jest.Mock | undefined = undefined;
  let metricsMetaMock: jest.Mock | undefined = undefined;

  beforeEach(function () {
    metricsTagsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/tags/`,
      body: [{key: 'environment'}, {key: 'release'}, {key: 'session.status'}],
    });

    metricsMetaMock = MockApiClient.addMockResponse({
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
  });

  it('works', async function () {
    render(
      <MetricsProvider organization={organization} projects={[project.id]}>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(metricsTagsMock).toHaveBeenCalledTimes(1);
    expect(metricsMetaMock).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('sentry.sessions.session')).toBeInTheDocument();
    expect(screen.getByText('sentry.sessions.session.error')).toBeInTheDocument();
  });

  it('skip load', async function () {
    render(
      <MetricsProvider organization={organization} projects={[project.id]} skipLoad>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(metricsTagsMock).not.toHaveBeenCalled();
    expect(metricsMetaMock).not.toHaveBeenCalled();

    expect(screen.queryByText('sentry.sessions.session')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry.sessions.session.error')).not.toBeInTheDocument();
  });

  it('throw when provider is not set', function () {
    try {
      render(<TestComponent other="value" />);
    } catch (error) {
      expect(error.message).toEqual(
        'useMetricMetas called but MetricsProvider is not set.'
      );
    }
  });
});
