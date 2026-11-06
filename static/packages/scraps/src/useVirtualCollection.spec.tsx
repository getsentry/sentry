import {useRef} from 'react';
import type {Node} from '@react-types/shared';
import {render, screen} from '@testing-library/react';

import {shouldVirtualize, useVirtualCollection} from './useVirtualCollection';

const ROW_COUNT = 300;
const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 100;
const LIST_PADDING = 4;

const nodes = Array.from(
  {length: ROW_COUNT},
  (_, index) =>
    ({key: `row-${index}`, type: 'item', props: {}}) as Node<Record<PropertyKey, unknown>>
);

function TestList({enabled}: {enabled: boolean}) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const {rows, spaceBefore, spaceAfter} = useVirtualCollection({
    nodes,
    enabled,
    size: 'md',
    scrollRef,
    listPadding: LIST_PADDING,
  });

  return (
    <ul ref={scrollRef}>
      <li data-test-id="space-before" style={{height: spaceBefore}} />
      {rows.map(({node, props}) => (
        <li key={node.key} data-test-id="row" data-row-props={props ? 'set' : 'unset'} />
      ))}
      <li data-test-id="space-after" style={{height: spaceAfter}} />
    </ul>
  );
}

function height(testId: string) {
  return parseFloat(screen.getByTestId(testId).style.height || '0');
}

const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight'
);

describe('useVirtualCollection', () => {
  // jsdom does not lay out, so the viewport and every row would measure 0px.
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.tagName === 'UL' ? VIEWPORT_HEIGHT : ROW_HEIGHT;
      },
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

  it('renders a window of rows with spacers standing in for the rest', () => {
    render(<TestList enabled />);

    const rendered = screen.getAllByTestId('row');
    expect(rendered.length).toBeLessThan(ROW_COUNT);
    expect(rendered[0]).toHaveAttribute('data-row-props', 'set');

    // The list's own padding is CSS, so spacers and rows add up to the rows'
    // height alone.
    const spanned =
      height('space-before') + rendered.length * ROW_HEIGHT + height('space-after');
    expect(spanned).toBe(ROW_COUNT * ROW_HEIGHT);
  });

  it('renders every row without measurement props when disabled', () => {
    render(<TestList enabled={false} />);

    const rendered = screen.getAllByTestId('row');
    expect(rendered).toHaveLength(ROW_COUNT);
    expect(rendered[0]).toHaveAttribute('data-row-props', 'unset');
    expect(height('space-before')).toBe(0);
    expect(height('space-after')).toBe(0);
  });
});

describe('shouldVirtualize', () => {
  const isSection = (item: {section?: boolean}) => Boolean(item.section);

  it('virtualizes flat lists above the threshold', () => {
    expect(
      shouldVirtualize(
        Array.from({length: 151}, () => ({})),
        {isSection}
      )
    ).toBe(true);
    expect(
      shouldVirtualize(
        Array.from({length: 150}, () => ({})),
        {isSection}
      )
    ).toBe(false);
  });

  it('never virtualizes lists with sections', () => {
    const items = [{section: true}, ...Array.from({length: 500}, () => ({}))];
    expect(shouldVirtualize(items, {isSection, threshold: 1})).toBe(false);
  });
});
