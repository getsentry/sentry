import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {MetricTimePeriodSelect} from 'sentry/views/detectors/components/details/metric/timePeriodSelect';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

describe('MetricTimePeriodSelect', () => {
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
});
