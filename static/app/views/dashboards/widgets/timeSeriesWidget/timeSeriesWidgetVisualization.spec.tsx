import type {Ref} from 'react';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Line} from './plottables/line';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

jest.mock('echarts-for-react/lib/core', () => {
  const {useImperativeHandle, useRef, useState} =
    jest.requireActual<typeof import('react')>('react');

  return function Chart({
    option,
    ref,
  }: {
    option: {
      series: Array<{
        data: Array<{value: [number, number]}>;
        name: string;
        type: string;
      }>;
      tooltip: {formatter: (params: unknown[], ticket: string) => string};
    };
    ref: Ref<unknown>;
  }) {
    const elementRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState('');
    useImperativeHandle(ref, () => ({ele: elementRef.current}), []);

    return (
      <div
        ref={elementRef}
        className="echarts-for-react"
        aria-label="Time series chart"
        onMouseOver={() => {
          const params = option.series.flatMap((series, seriesIndex) => {
            const data = series.data[0];
            return data
              ? [
                  {
                    data,
                    value: data.value,
                    seriesName: series.name,
                    seriesType: series.type,
                    seriesIndex,
                    dataIndex: 0,
                    marker: '',
                  },
                ]
              : [];
          });
          setTooltip(option.tooltip.formatter(params, 'test'));
        }}
      >
        <div role="tooltip" dangerouslySetInnerHTML={{__html: tooltip}} />
      </div>
    );
  };
});

describe('TimeSeriesWidgetVisualization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows ordered transformation suffixes beside aliases in the tooltip', async () => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const original = new Line(TimeSeriesFixture(), {alias: 'Duration'});
    const transformed = new Line(
      TimeSeriesFixture({
        requestedTransformations: ['fill(linear)', 'smooth(sma,5)'],
      }),
      {alias: 'Duration'}
    );
    render(<TimeSeriesWidgetVisualization plottables={[original, transformed]} />);

    expect(
      screen.getByRole('button', {
        name: 'Toggle Duration · fill(linear) → smooth(sma,5)',
      })
    ).toBeInTheDocument();
    await userEvent.hover(screen.getByLabelText('Time series chart'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Duration · fill(linear) → smooth(sma,5)');
    expect(within(tooltip).getAllByText('Duration')).toHaveLength(2);
    expect(tooltip).toHaveTextContent('7.46K/s');
  });

  it('escapes alias and suffix text when rendering tooltip HTML', async () => {
    const plottable = new Line(
      TimeSeriesFixture({requestedTransformations: ['fill(<img src=x>)']}),
      {alias: '<b>Duration</b>'}
    );
    render(<TimeSeriesWidgetVisualization plottables={[plottable]} />);

    await userEvent.hover(screen.getByLabelText('Time series chart'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('<b>Duration</b> · fill(<img src=x>)');
    expect(within(tooltip).queryByRole('img')).not.toBeInTheDocument();
  });
});
