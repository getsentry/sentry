import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import MriField from 'sentry/views/alerts/rules/metric/mriField';

describe('MRIField', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/meta/',
      body: [
        {
          type: 'd',
          name: 'sentry.distribution.metric',
          unit: 'second',
          mri: 'd:custom/sentry.distribution.metric@second',
          operations: [
            'avg',
            'count',
            'histogram',
            'max',
            'max_timestamp',
            'min',
            'min_timestamp',
            'p50',
            'p75',
            'p90',
            'p95',
            'p99',
            'sum',
          ],
          projectIds: [1],
          blockingStatus: [],
        },
      ],
    });
  });
  it('should call onChange with the new aggregate string when switching aggregates', async () => {
    const {project} = initializeOrg();
    const onChange = jest.fn();
    render(
      <MriField
        aggregate={'sum(d:custom/sentry.distribution.metric@second)'}
        onChange={onChange}
        project={project}
      />
    );
    await screen.findByText('Select an operation');
    await userEvent.click(screen.getByText('sum'));
    await userEvent.click(await screen.findByText('p95'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        'p95(d:custom/sentry.distribution.metric@second)',
        {}
      )
    );
  });
});
