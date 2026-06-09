import {ThemeFixture} from 'sentry-fixture/theme';

import {computeChartTooltip} from 'sentry/components/charts/components/tooltip';

const theme = ThemeFixture();

type PositionFn = (
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
  chart.id = 'chart';
  document.body.appendChild(chart);
  jest
    .spyOn(chart, 'getBoundingClientRect')
    .mockReturnValue({top: 100, left: 100} as DOMRect);

  const dom = document.createElement('div');
  const arrow = document.createElement('div');
  arrow.className = 'tooltip-arrow';
  dom.appendChild(arrow);

  const tooltip = computeChartTooltip({appendToBody: true, chartId: 'chart'}, theme);
  const position = tooltip!.position as PositionFn;

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
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('positions the tooltip above the cursor when it fits', () => {
    const {top, arrow} = getTooltipPosition({tipHeight: 50, cursorY: 80});

    expect(top).toBe(80 - 50 - 20);
    expect(arrow).not.toHaveClass('arrow-top');
  });

  it('positions the tooltip below the cursor when it is too tall to fit above', () => {
    const {top, arrow} = getTooltipPosition({tipHeight: 300, cursorY: 50});

    expect(top).toBe(50 + 20);
    expect(arrow).toHaveClass('arrow-top');
  });
});
