import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import InsightsMetricField from 'sentry/views/alerts/rules/metric/insightsMetricField';

describe('InsightsMetricField', () => {
  let metaMock;
  beforeEach(() => {
    metaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/meta/',
      body: [
        {
          type: 'd',
          name: 'exclusive_time',
          unit: 'millisecond',
          mri: 'd:spans/exclusive_time@millisecond',
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

  it('renders', async () => {
    const {project} = initializeOrg();
    render(
      <InsightsMetricField
        aggregate={'avg(d:spans/exclusive_time@millisecond)'}
        onChange={() => {}}
        project={project}
      />
    );
    await waitFor(() => {
      expect(metaMock).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/meta/',
        expect.objectContaining({
          query: {
            project: [2],
            useCase: ['spans'],
          },
        })
      );
    });
    screen.getByText('avg');
    screen.getByText('span.exclusive_time');
  });

  it('should call onChange with the new aggregate string when switching aggregates', async () => {
    const {project} = initializeOrg();
    const onChange = jest.fn();
    render(
      <InsightsMetricField
        aggregate={'avg(d:spans/exclusive_time@millisecond)'}
        onChange={onChange}
        project={project}
      />
    );
    await userEvent.click(screen.getByText('avg'));
    await userEvent.click(await screen.findByText('sum'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('sum(d:spans/exclusive_time@millisecond)', {})
    );
  });

  it('should call onChange using the spm function with no arguments when switching to spm', async () => {
    const {project} = initializeOrg();
    const onChange = jest.fn();
    render(
      <InsightsMetricField
        aggregate={'avg(d:spans/exclusive_time@millisecond)'}
        onChange={onChange}
        project={project}
      />
    );
    await userEvent.click(screen.getByText('avg'));
    await userEvent.click(await screen.findByText('spm'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('spm()', {}));
  });

  it('should call onChange using the http_response_rate function defaulting with argument 3 when switching to http_response_rate', async () => {
    const {project} = initializeOrg();
    const onChange = jest.fn();
    render(
      <InsightsMetricField
        aggregate={'avg(d:spans/exclusive_time@millisecond)'}
        onChange={onChange}
        project={project}
      />
    );
    await userEvent.click(screen.getByText('avg'));
    await userEvent.click(await screen.findByText('http_response_rate'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('http_response_rate(3)', {})
    );
  });
});
