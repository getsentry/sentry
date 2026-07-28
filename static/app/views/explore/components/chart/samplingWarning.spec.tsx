import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {SamplingWarning} from 'sentry/views/explore/components/chart/samplingWarning';

describe('SamplingWarning', () => {
  it('shows the partial-data warning with the aggregate name', async () => {
    render(<SamplingWarning yAxis="count_unique(user)" reason="partialData" />);

    await userEvent.hover(screen.getByTestId('sampling-warning'));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Due to the estimation being applied, count_unique is likely to return unreliable results. Treat count_unique for estimation purposes only.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows the low-sample-rate warning with the aggregate name', async () => {
    render(<SamplingWarning yAxis="count_unique(user)" reason="lowSampleRate" />);

    await userEvent.hover(screen.getByTestId('sampling-warning'));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Due to your configured sample rate, count_unique is likely to return unreliable results. Increase your sample rate, or treat count_unique for estimation purposes only.'
        )
      )
    ).toBeInTheDocument();
  });
});
