import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import {MetricsProvider} from 'sentry/utils/metrics/metricsProvider';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';

function mockMetricsAndTags(orgSlug: Organization['slug']) {
  const tagsMock = MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/tags/`,
    body: [{key: 'environment'}, {key: 'release'}, {key: 'session.status'}],
  });

  const metasMock = MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/meta/`,
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

  return {tagsMock, metasMock};
}

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

  it("fetches metrics and tags and save values in the context's state", async function () {
    const {tagsMock, metasMock} = mockMetricsAndTags(organization.slug);

    render(
      <MetricsProvider organization={organization} projects={[project.id]}>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(tagsMock).toHaveBeenCalledTimes(1);
    expect(metasMock).toHaveBeenCalledTimes(1);

    // includes metric tags
    expect(await screen.findByText('session.status')).toBeInTheDocument();

    // include metric metas
    expect(screen.getByText('sentry.sessions.session')).toBeInTheDocument();
    expect(screen.getByText('sentry.sessions.session.error')).toBeInTheDocument();
  });

  it('skip metrics and tags fetches', function () {
    const {tagsMock, metasMock} = mockMetricsAndTags(organization.slug);

    render(
      <MetricsProvider organization={organization} projects={[project.id]} skipLoad>
        <TestComponent other="value" />
      </MetricsProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(tagsMock).not.toHaveBeenCalled();
    expect(metasMock).not.toHaveBeenCalled();

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
