import {render, screen} from 'sentry-test/reactTestingLibrary';

import MetricsTagStore from 'sentry/stores/metricsTagStore';
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
  it('works', async function () {
    const organization = TestStubs.Organization();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/tags/`,
      body: [{key: 'environment'}, {key: 'release'}, {key: 'session.status'}],
    });

    jest.spyOn(MetricsTagStore, 'trigger');

    render(<TestComponent other="value" />, {organization});

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(MetricsTagStore.trigger).toHaveBeenCalledTimes(1);

    // includes custom metricsTags
    expect(await screen.findByText('session.status')).toBeInTheDocument();
  });
});
