import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {MetricTimePeriodSelect} from 'sentry/views/detectors/components/details/metric/timePeriodSelect';

describe('MetricTimePeriodSelect', () => {
  it('navigates by updating statsPeriod in the query when selecting an option', async () => {
    const {router} = render(
      <MetricTimePeriodSelect dataset={Dataset.ERRORS} interval={300} />
    );

    // Opens the select and chooses a different period
    await userEvent.click(
      // Default selected should be Last 7 days for this interval/dataset
      screen.getByRole('button', {name: /last 7 days/i})
    );

    await userEvent.click(screen.getByText(/last 14 days/i));

    await waitFor(() => {
      expect(router.location.query.statsPeriod).toBe('14d');
    });

    // Ensure absolute range is cleared
    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.end).toBeUndefined();
  });
});
