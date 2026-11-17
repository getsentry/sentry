import type {CallbackDataParams} from 'echarts/types/dist/shared';

import {act, renderHookWithProviders, within} from 'sentry-test/reactTestingLibrary';

import {Text} from '@sentry/scraps/text';

import {CHART_TOOLTIP_VIEWPORT_OFFSET} from 'sentry/components/charts/components/tooltip';
import type {ReactEchartsRef} from 'sentry/types/echarts';

import type {BandBucket} from './bandShapes';
import {useBandTooltips} from './bandTooltip';
import type {ChartBand} from './mergeChartBands';

const MINUTE = 60_000;
const START = Date.UTC(2024, 0, 12, 15, 0);

function bucket(minute: number): BandBucket {
  return {start: START + minute * MINUTE, end: START + (minute + 1) * MINUTE};
}

function band(id: string, buckets: BandBucket[], withSection = true): ChartBand {
  const starts = new Set(buckets.map(({start}) => start));

  return {
    id,
    buckets,
    height: 8,
    series: () => ({type: 'custom', name: id}),
    tooltipSection: withSection
      ? start =>
          starts.has(start) ? <Text>{`${id} at ${(start - START) / MINUTE}`}</Text> : null
      : undefined,
  };
}

function chartRefOf({
  chartLeft = 0,
  hovered = true,
} = {}): React.RefObject<ReactEchartsRef | null> {
  const ele = document.createElement('div');
  ele.getBoundingClientRect = () => ({left: chartLeft}) as DOMRect;

  const querySelector = document.querySelector.bind(document);
  jest
    .spyOn(document, 'querySelector')
    .mockImplementation(selector =>
      selector === '.echarts-for-react:hover'
        ? hovered
          ? ele
          : null
        : querySelector(selector)
    );

  return {current: {ele} as unknown as ReactEchartsRef};
}

function tooltipOf(chartBand: ChartBand | undefined) {
  const tooltip = chartBand?.series(0).tooltip;
  if (typeof tooltip?.formatter !== 'function') {
    throw new Error('Expected the band to have a tooltip');
  }
  return tooltip;
}

async function hover(
  chartBand: ChartBand | undefined,
  dataIndex: number
): Promise<HTMLElement> {
  const formatter = tooltipOf(chartBand).formatter as (
    params: CallbackDataParams
  ) => string;
  const container = document.createElement('div');
  container.innerHTML = await act(() => formatter({dataIndex} as CallbackDataParams));
  return container;
}

describe('useBandTooltips', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the same sections for a bucket whichever band is hovered', async () => {
    const chartRef = chartRefOf();
    const {result} = renderHookWithProviders(() =>
      useBandTooltips(
        [band('dropped', [bucket(0), bucket(1)]), band('releases', [bucket(1)])],
        {chartRef, utc: true}
      )
    );
    const [dropped, releases] = result.current;

    const fromDropped = await hover(dropped, 1);
    const fromReleases = await hover(releases, 0);

    expect(fromDropped.innerHTML).toBe(fromReleases.innerHTML);
    expect(within(fromDropped).getByRole('banner')).toHaveTextContent(
      'Jan 12, 2024 3:01 PM - 3:02 PM UTC'
    );
    expect(fromDropped).toHaveTextContent(/dropped at 1.*releases at 1/);
  });

  it('leaves out bands with nothing in the hovered bucket', async () => {
    const chartRef = chartRefOf();
    const {result} = renderHookWithProviders(() =>
      useBandTooltips(
        [band('dropped', [bucket(0), bucket(1)]), band('releases', [bucket(1)])],
        {chartRef}
      )
    );

    const tooltip = await hover(result.current[0], 0);

    expect(tooltip).toHaveTextContent('dropped at 0');
    expect(tooltip).not.toHaveTextContent('releases');
  });

  it('gives no tooltip to bands without a section and drops hidden bands', () => {
    const plain = band('plain', [bucket(0)], false);
    const {result} = renderHookWithProviders(() =>
      useBandTooltips([null, plain], {chartRef: chartRefOf()})
    );

    expect(result.current).toEqual([plain]);
  });

  it('shows nothing while the chart is not hovered', async () => {
    const {result} = renderHookWithProviders(() =>
      useBandTooltips([band('dropped', [bucket(0)])], {
        chartRef: chartRefOf({hovered: false}),
      })
    );

    const tooltip = await hover(result.current[0], 0);

    expect(tooltip).toBeEmptyDOMElement();
  });

  it('keeps the tooltip below the hovered bucket and inside the viewport', () => {
    const chartLeft = 40;
    const tipWidth = 200;
    const anchorX = window.innerWidth - chartLeft - 10;

    const {result} = renderHookWithProviders(() =>
      useBandTooltips([band('dropped', [bucket(0)])], {
        chartRef: chartRefOf({chartLeft}),
      })
    );

    const {position} = tooltipOf(result.current[0]);
    if (typeof position !== 'function') {
      throw new Error('Expected the band tooltip to position itself');
    }

    const tooltip = document.createElement('div');
    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow arrow-top';
    tooltip.append(arrow);

    const {left, top} = position(
      [0, 0],
      [],
      tooltip,
      {x: anchorX - 30, y: 170, width: 60, height: 10},
      {contentSize: [tipWidth, 120], viewSize: [800, 300]}
    ) as {left: number; top: number};

    expect(top).toBe(188);
    expect(chartLeft + left + tipWidth).toBe(
      window.innerWidth - CHART_TOOLTIP_VIEWPORT_OFFSET
    );
    expect(arrow).toHaveStyle({left: `${anchorX - left}px`});
  });
});
