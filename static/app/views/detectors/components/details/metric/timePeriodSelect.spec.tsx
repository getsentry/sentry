import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {MetricTimePeriodSelect} from 'sentry/views/detectors/components/details/metric/timePeriodSelect';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

describe('MetricTimePeriodSelect', () => {
  it('syncs default statsPeriod into query when none is provided', async () => {
    const {router} = render(
      <MetricTimePeriodSelect dataset={DetectorDataset.ERRORS} interval={300} />
    );

    await waitFor(() => {
      expect(router.location.query.statsPeriod).toBe('14d');
    });

    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.end).toBeUndefined();
  });

  it('navigates by updating statsPeriod in the query when selecting an option', async () => {
    const {router} = render(
      <MetricTimePeriodSelect dataset={DetectorDataset.ERRORS} interval={300} />
    );

    // Opens the select and chooses a different period
    await userEvent.click(
      // Default currently selected
      screen.getByRole('button', {name: /last 14 days/i})
    );

    await userEvent.click(screen.getByText(/last 7 days/i));

    await waitFor(() => {
      expect(router.location.query.statsPeriod).toBe('7d');
    });

    // Ensure absolute range is cleared
    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.end).toBeUndefined();
  });

  it('displays custom statsPeriod values from the URL', async () => {
    const {router} = render(
      <MetricTimePeriodSelect dataset={DetectorDataset.ERRORS} interval={300} />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {
              statsPeriod: '4h',
            },
          },
        },
      }
    );

    expect(
      await screen.findByRole('button', {name: /custom time:\s*last 4 hours/i})
    ).toBeInTheDocument();
    expect(router.location.query.statsPeriod).toBe('4h');
  });
});
