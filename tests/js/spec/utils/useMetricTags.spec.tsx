import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricsProvider} from 'sentry/utils/metrics/metricsContext';
import {useMetricTags} from 'sentry/utils/useMetricTags';

function TestComponent({other}: {other: string}) {
  const {metricTags} = useMetricTags();
  return (
    <div>
      <span>{other}</span>
      {metricTags &&
        Object.entries(metricTags).map(([key, tag]) => <em key={key}>{tag.key}</em>)}
    </div>
  );
}

describe('useMetricTags', function () {
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

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(metricsTagsMock).toHaveBeenCalledTimes(1);
    expect(metricsMetaMock).toHaveBeenCalledTimes(1);

    // includes custom metricsTags
    expect(await screen.findByText('session.status')).toBeInTheDocument();
  });

  it('skip load', function () {
    render(
      <MetricsProvider organization={organization} projects={[project.id]} skipLoad>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(metricsTagsMock).not.toHaveBeenCalled();
    expect(metricsMetaMock).not.toHaveBeenCalled();

    // does not includes custom metricsTags
    expect(screen.queryByText('session.status')).not.toBeInTheDocument();
  });

  it('throw when provider is not set', function () {
    try {
      render(<TestComponent other="value" />);
    } catch (error) {
      expect(error.message).toEqual(
        'useMetricTags called but MetricsProvider is not set.'
      );
    }
  });
});
