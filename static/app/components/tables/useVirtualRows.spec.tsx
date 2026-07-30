import {useRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';

const ROW_COUNT = 100;
const ROW_HEIGHT = 20;
const VIEWPORT_HEIGHT = 100;

function TestList({scrollMargin}: {scrollMargin?: number}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {paddingBottom, paddingTop, virtualItems} = useVirtualRows({
    count: ROW_COUNT,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => scrollRef.current,
    scrollMargin,
  });

  return (
    <div ref={scrollRef}>
      <div data-test-id="padding-top" style={{height: paddingTop}} />
      {virtualItems.map(item => (
        <div key={item.key} data-test-id="row" style={{height: ROW_HEIGHT}} />
      ))}
      <div data-test-id="padding-bottom" style={{height: paddingBottom}} />
    </div>
  );
}

/**
 * The spacers stand in for every row outside the window, so together with the
 * rendered rows they must always add up to the full list height. Getting that
 * total wrong is what leaves blank gaps or an unreachable scroll range.
 */
function spacerHeight(testId: 'padding-top' | 'padding-bottom') {
  return parseInt(screen.getByTestId(testId).style.height, 10);
}

function spannedHeight() {
  const rendered = screen.queryAllByTestId('row').length;

  return (
    spacerHeight('padding-top') + rendered * ROW_HEIGHT + spacerHeight('padding-bottom')
  );
}

const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight'
);

describe('useVirtualRows', () => {
  // jsdom does not lay out, and the ResizeObserver stub never reports a size, so the
  // virtualizer reads offsetHeight as 0 and windows out every row.
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });
  });

  afterEach(() => {
    if (offsetHeightDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetHeight',
        offsetHeightDescriptor
      );
    }
  });

  it('spans the full list height when most rows are outside the window', () => {
    render(<TestList />);

    expect(spannedHeight()).toBe(ROW_COUNT * ROW_HEIGHT);
  });

  // A scrollMargin left in the leading spacer shows up as a blank gap above the
  // first row, because the margin is already accounted for outside the list.
  it('does not pad above the first row when the list starts below the scroll container', () => {
    render(<TestList scrollMargin={200} />);

    expect(spacerHeight('padding-top')).toBe(0);
    expect(spannedHeight()).toBe(ROW_COUNT * ROW_HEIGHT);
  });
});
