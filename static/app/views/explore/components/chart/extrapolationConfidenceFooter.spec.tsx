import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {Thresholds} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/thresholds';

import {
  ExtrapolationConfidenceFooter,
  hasLowConfidencePlottables,
} from './extrapolationConfidenceFooter';

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

  it('renders nothing when extrapolated data is high confidence', () => {
    const {container} = render(
      <ExtrapolationConfidenceFooter
        plottables={[
          makeLine([{sampleRate: 1}, {sampleRate: 1}]),
          makeLine([{sampleRate: 0.5, confidence: 'high'}]),
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
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

    expect(screen.getByText('Low confidence data')).toBeInTheDocument();
  });
});

describe('hasLowConfidencePlottables', () => {
  it('is true only when some plottable has low confidence data', () => {
    expect(hasLowConfidencePlottables([])).toBe(false);
    expect(
      hasLowConfidencePlottables([makeLine([{sampleRate: 0.5, confidence: 'high'}])])
    ).toBe(false);
    expect(
      hasLowConfidencePlottables([
        makeLine([{sampleRate: 0.5, confidence: 'high'}]),
        makeLine([{sampleRate: 0.01, confidence: 'low'}]),
      ])
    ).toBe(true);
  });
});

function makeLine(points: Array<Partial<TimeSeriesItem>>) {
  return new Line(
    TimeSeriesFixture({
      values: points.map((point, index) => ({timestamp: index, value: 1, ...point})),
    })
  );
}
