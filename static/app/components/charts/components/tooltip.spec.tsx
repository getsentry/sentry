import {ThemeFixture} from 'sentry-fixture/theme';

import {
  CHART_TOOLTIP_VIEWPORT_OFFSET,
  computeChartTooltip,
} from 'sentry/components/charts/components/tooltip';

const chartId = 'chart';
const theme = ThemeFixture();

type PositionCallback = (
  pos: [number, number],
  params: unknown,
  dom: HTMLElement,
  rec: unknown,
  size: {contentSize: [number, number]; viewSize: [number, number]}
) => {left: number; top: number};

function getTooltipPosition({cursorY, tipHeight}: {cursorY: number; tipHeight: number}) {
  // The chart is looked up by id and measured via getBoundingClientRect, which
  // jsdom does not implement. Only `top` and `left` are read.
  const chart = document.createElement('div');
  chart.id = chartId;
  document.body.appendChild(chart);
  jest
    .spyOn(chart, 'getBoundingClientRect')
    .mockReturnValue({top: 100, left: 100} as DOMRect);

  const dom = document.createElement('div');
  const arrow = document.createElement('div');
  arrow.className = 'tooltip-arrow';
  dom.appendChild(arrow);

  const tooltip = computeChartTooltip({appendToBody: true, chartId}, theme);
  const position = tooltip!.position as PositionCallback;

  const {top} = position(
    [200, cursorY],
    {},
    dom,
    {},
    {
      contentSize: [100, tipHeight],
      viewSize: [0, 0],
    }
  );

  return {top, arrow};
}

describe('computeChartTooltip', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('positions the tooltip above the cursor when it fits', () => {
    const tipHeight = 50;
    const cursorY = 80;
    const {top, arrow} = getTooltipPosition({tipHeight, cursorY});

    expect(top).toBe(cursorY - tipHeight - CHART_TOOLTIP_VIEWPORT_OFFSET);
    expect(arrow).not.toHaveClass('arrow-top');
  });

  it('positions the tooltip below the cursor when it is too tall to fit above', () => {
    const tipHeight = 300;
    const cursorY = 50;
    const {top, arrow} = getTooltipPosition({tipHeight, cursorY});

    expect(top).toBe(50 + CHART_TOOLTIP_VIEWPORT_OFFSET);
    expect(arrow).toHaveClass('arrow-top');
  });
});
