import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {SimpleGroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDetailsOpenPeriodIssues} from 'sentry/views/detectors/components/details/common/openPeriodIssues';

describe('DetectorDetailsOpenPeriodIssues', () => {
  it('renders latest issue with one open period', async () => {
    const detector = MetricDetectorFixture({
      latestGroup: SimpleGroupFixture({
        id: '1234',
      }),
      dataSources: [
        SnubaQueryDataSourceFixture({
          queryObj: {
            id: '1',
            status: 1,
            subscription: '1',
            snubaQuery: {
              aggregate: 'count()',
              dataset: Dataset.ERRORS,
              id: '1',
              query: '',
              timeWindow: 60,
              eventTypes: [EventTypes.ERROR],
            },
          },
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1234/`,
      body: detector.latestGroup,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/open-periods/`,
      body: [
        {
          start: '2025-06-01T10:00:00Z',
          end: '2025-06-01T11:00:00Z',
          duration: '3600',
          isOpen: false,
          lastChecked: '2025-06-01T11:00:00Z',
        },
      ],
    });

    render(<DetectorDetailsOpenPeriodIssues detector={detector} />);

    expect(await screen.findByTestId('event-issue-header')).toBeInTheDocument();

    expect(await screen.findByText('Started')).toBeInTheDocument();
    expect(await screen.findByText('Ended')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Zoom'})).toBeInTheDocument();
  });
});
