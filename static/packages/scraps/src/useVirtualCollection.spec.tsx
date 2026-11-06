import {Fragment, useRef} from 'react';
import type {Node} from '@react-types/shared';
import {fireEvent, render, screen} from '@testing-library/react';

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

function TestList({enabled, focusedKey}: {enabled: boolean; focusedKey?: string}) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const {rows, spaceAfter} = useVirtualCollection({
    nodes,
    enabled,
    size: 'md',
    scrollRef,
    focusedKey,
    listPadding: LIST_PADDING,
  });

  return (
    <ul ref={scrollRef} data-test-id="list">
      {rows.map(({node, props, spaceBefore}) => (
        <Fragment key={node.key}>
          <li data-test-id="spacer" style={{height: spaceBefore}} />
          <li
            {...props}
            data-test-id="row"
            data-key={node.key}
            data-row-props={props ? 'set' : 'unset'}
          />
        </Fragment>
      ))}
      <li data-test-id="spacer" style={{height: spaceAfter}} />
    </ul>
  );
}

function spacerHeights() {
  return screen
    .getAllByTestId('spacer')
    .map(spacer => parseFloat(spacer.style.height || '0'));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
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
    const spanned = sum(spacerHeights()) + rendered.length * ROW_HEIGHT;
    expect(spanned).toBe(ROW_COUNT * ROW_HEIGHT);
  });

  it('keeps the focused row mounted after it scrolls out of view', () => {
    render(<TestList enabled focusedKey="row-0" />);

    const list = screen.getByTestId('list');
    list.scrollTop = 150 * ROW_HEIGHT;
    fireEvent.scroll(list);

    const keys = screen.getAllByTestId('row').map(row => row.dataset.key);
    expect(keys[0]).toBe('row-0');
    expect(keys).toContain('row-150');
    expect(keys).not.toContain('row-1');

    // A spacer fills the gap between the focused row and the window, so the
    // list keeps its full height.
    const spanned = sum(spacerHeights()) + keys.length * ROW_HEIGHT;
    expect(spanned).toBe(ROW_COUNT * ROW_HEIGHT);
  });

  it('renders every row without measurement props when disabled', () => {
    render(<TestList enabled={false} />);

    const rendered = screen.getAllByTestId('row');
    expect(rendered).toHaveLength(ROW_COUNT);
    expect(rendered[0]).toHaveAttribute('data-row-props', 'unset');
    expect(sum(spacerHeights())).toBe(0);
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
