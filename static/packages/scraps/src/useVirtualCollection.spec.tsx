import {Fragment, useRef} from 'react';
import type {Node} from '@react-types/shared';
import {fireEvent, render, screen} from '@testing-library/react';

import {groupVirtualRows, useVirtualCollection} from './useVirtualCollection';

const ROW_COUNT = 300;
const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 100;
const LIST_PADDING = 4;

const nodes = Array.from(
  {length: ROW_COUNT},
  (_, index) =>
    ({key: `row-${index}`, type: 'item', props: {}}) as Node<Record<PropertyKey, unknown>>
);

function TestList({
  enabled,
  focusedKey,
  items = nodes,
}: {
  enabled: boolean;
  focusedKey?: string;
  items?: typeof nodes;
}) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const {rows, spaceAfter} = useVirtualCollection({
    nodes: items,
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

  it('mounts rows when the list is only as tall as its content', () => {
    // Like DropdownMenu's list, which has no padding: before any row mounts,
    // its height comes from the spacers alone.
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.tagName !== 'UL') {
          return ROW_HEIGHT;
        }
        const content =
          sum(spacerHeights()) + screen.queryAllByTestId('row').length * ROW_HEIGHT;
        return Math.min(VIEWPORT_HEIGHT, content);
      },
    });

    render(<TestList enabled />);

    expect(screen.getAllByTestId('row').length).toBeGreaterThan(0);
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

  it('keeps the section row of mounted rows mounted', () => {
    const sectioned = ['a', 'b'].flatMap(section => [
      {key: `section-${section}`, type: 'section', props: {}},
      ...Array.from({length: ROW_COUNT / 2}, (_, index) => ({
        key: `${section}-${index}`,
        type: 'item',
        parentKey: `section-${section}`,
        props: {},
      })),
    ]) as typeof nodes;
    render(<TestList enabled items={sectioned} />);

    const list = screen.getByTestId('list');
    list.scrollTop = 250 * ROW_HEIGHT;
    fireEvent.scroll(list);

    const keys = screen.getAllByTestId('row').map(row => row.dataset.key);
    expect(keys[0]).toBe('section-b');
    expect(keys).toContain('b-100');
    expect(keys).not.toContain('b-0');
    expect(keys).not.toContain('section-a');

    const spanned = sum(spacerHeights()) + keys.length * ROW_HEIGHT;
    expect(spanned).toBe(sectioned.length * ROW_HEIGHT);
  });

  it('renders every row without measurement props when disabled', () => {
    render(<TestList enabled={false} />);

    const rendered = screen.getAllByTestId('row');
    expect(rendered).toHaveLength(ROW_COUNT);
    expect(rendered[0]).toHaveAttribute('data-row-props', 'unset');
    expect(sum(spacerHeights())).toBe(0);
  });
});

describe('groupVirtualRows', () => {
  it('puts the rows of each section under their section row', () => {
    const row = (key: string, type = 'item', parentKey?: string) => ({
      node: {key, type, parentKey} as (typeof nodes)[number],
      props: undefined,
      spaceBefore: 0,
    });
    const groups = groupVirtualRows([
      row('top'),
      row('section-a', 'section'),
      row('a-1', 'item', 'section-a'),
      row('a-2', 'item', 'section-a'),
      row('after'),
    ]);

    expect(
      groups.map(group => ({
        section: group.section?.node.key,
        rows: group.rows.map(r => r.node.key),
      }))
    ).toEqual([
      {section: undefined, rows: ['top']},
      {section: 'section-a', rows: ['a-1', 'a-2']},
      {section: undefined, rows: ['after']},
    ]);
  });
});
