import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {SamplingWarning} from 'sentry/views/explore/components/chart/samplingWarning';

function seriesWithSampleRates(sampleRates: Array<number | null>): TimeSeries[] {
  return [
    TimeSeriesFixture({
      values: sampleRates.map((sampleRate, index) => ({
        value: 1,
        timestamp: 1729796400000 + index,
        sampleRate,
      })),
    }),
  ];
}

describe('SamplingWarning', () => {
  it('shows the partial-data warning for a sensitive aggregate when partially scanned', async () => {
    render(
      <SamplingWarning
        yAxis="count_unique(user)"
        series={seriesWithSampleRates([1, 1])}
        dataScanned="partial"
      />
    );

    await userEvent.hover(screen.getByTestId('sampling-warning'));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Due to the estimation being applied, count_unique is likely to return unreliable results. Treat count_unique for estimation purposes only.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows the low-sample-rate warning for a sensitive aggregate below the threshold', async () => {
    render(
      <SamplingWarning
        yAxis="count_unique(user)"
        series={seriesWithSampleRates([0.05, 0.05])}
        dataScanned="full"
      />
    );

    await userEvent.hover(screen.getByTestId('sampling-warning'));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Due to your configured sample rate, count_unique is likely to return unreliable results. Increase your sample rate, or treat count_unique for estimation purposes only.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders nothing for a non-sensitive aggregate', () => {
    render(
      <SamplingWarning
        yAxis="count()"
        series={seriesWithSampleRates([0.05, 0.05])}
        dataScanned="partial"
      />
    );

    expect(screen.queryByTestId('sampling-warning')).not.toBeInTheDocument();
  });

  it('renders nothing for a sensitive aggregate when there is no sampling signal', () => {
    render(
      <SamplingWarning
        yAxis="count_unique(user)"
        series={seriesWithSampleRates([1, 1])}
        dataScanned="full"
      />
    );

    expect(screen.queryByTestId('sampling-warning')).not.toBeInTheDocument();
  });
});
