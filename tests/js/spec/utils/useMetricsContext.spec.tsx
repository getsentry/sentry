import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricsProvider} from 'sentry/utils/metrics/metricsProvider';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';

function TestComponent({other}: {other: string}) {
  const {tags, metas} = useMetricsContext();
  return (
    <div>
      <span>{other}</span>
      {tags && Object.entries(tags).map(([key, tag]) => <em key={key}>{tag.key}</em>)}
      {metas &&
        Object.entries(metas).map(([key, meta]) => <em key={key}>{meta.name}</em>)}
    </div>
  );
}

describe('useMetricsContext', function () {
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

  it("fetches metrics and tags and save values in the context's state", async function () {
    render(
      <MetricsProvider organization={organization} projects={[project.id]}>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(metricsTagsMock).toHaveBeenCalledTimes(1);
    expect(metricsMetaMock).toHaveBeenCalledTimes(1);

    // includes metric tags
    expect(await screen.findByText('session.status')).toBeInTheDocument();

    // include metric metas
    expect(screen.getByText('sentry.sessions.session')).toBeInTheDocument();
    expect(screen.getByText('sentry.sessions.session.error')).toBeInTheDocument();
  });

  it('skip metrics and tags fetches', function () {
    render(
      <MetricsProvider organization={organization} projects={[project.id]} skipLoad>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(metricsTagsMock).not.toHaveBeenCalled();
    expect(metricsMetaMock).not.toHaveBeenCalled();

    // does not include metrics tags
    expect(screen.queryByText('session.status')).not.toBeInTheDocument();

    // does not include metrics metas
    expect(screen.queryByText('sentry.sessions.session')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry.sessions.session.error')).not.toBeInTheDocument();
  });

  it('throw when provider is not set', function () {
    try {
      render(<TestComponent other="value" />);
    } catch (error) {
      expect(error.message).toEqual(
        'useMetricsContext was called outside of MetricsProvider'
      );
    }
  });
});
