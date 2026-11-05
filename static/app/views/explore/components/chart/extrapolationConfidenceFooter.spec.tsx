import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {Thresholds} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/thresholds';

import {ExtrapolationConfidenceFooter} from './extrapolationConfidenceFooter';

describe('ExtrapolationConfidenceFooter', () => {
  it('renders nothing when no data is extrapolated', () => {
    const {container} = render(
      <ExtrapolationConfidenceFooter
        plottables={[
          makeLine([{sampleRate: 1}, {sampleRate: 1}]),
          new Thresholds({thresholds: {max_values: {max1: 100}, unit: null}}),
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the extrapolation indicator with a docs link for extrapolated data', async () => {
    render(
      <ExtrapolationConfidenceFooter
        plottables={[
          makeLine([{sampleRate: 1}, {sampleRate: 1}]),
          makeLine([{sampleRate: 0.5, confidence: 'high'}]),
        ]}
      />
    );

    expect(screen.queryByText('Low confidence data')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByTestId('extrapolation-indicator'));

    expect(
      await screen.findByText(/Some of this data is extrapolated from sampled events/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Learn more'})).toHaveAttribute(
      'href',
      expect.stringContaining('docs.sentry.io')
    );
  });

  it('shows the low confidence warning when any data is low confidence', () => {
    render(
      <ExtrapolationConfidenceFooter
        plottables={[
          makeLine([{sampleRate: 0.5, confidence: 'high'}]),
          makeLine([
            {sampleRate: 0.5, confidence: 'high'},
            {sampleRate: 0.01, confidence: 'low'},
          ]),
        ]}
      />
    );

    expect(screen.getByTestId('extrapolation-indicator')).toBeInTheDocument();
    expect(screen.getByText('Low confidence data')).toBeInTheDocument();
  });
});

function makeLine(points: Array<Partial<TimeSeriesItem>>) {
  return new Line(
    TimeSeriesFixture({
      values: points.map((point, index) => ({timestamp: index, value: 1, ...point})),
    })
  );
}
