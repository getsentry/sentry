import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EAPField from 'sentry/views/alerts/rules/metric/eapField';

describe('EAPField', () => {
  let metaMock;
  beforeEach(() => {
    metaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/meta/',
      body: [
        {
          type: 'd',
          name: 'duration',
          unit: 'millisecond',
          mri: 'd:spans/duration@millisecond',
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
      <EAPField
        aggregate={'count(span.duration)'}
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
    screen.getByText('count');
    screen.getByText('span.duration');
  });

  it('should call onChange with the new aggregate string when switching aggregates', async () => {
    const {project} = initializeOrg();
    const onChange = jest.fn();
    render(
      <EAPField
        aggregate={'count(span.duration)'}
        onChange={onChange}
        project={project}
      />
    );
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('max'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('max(span.duration)', {}));
  });
});
