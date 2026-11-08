import {Fragment, useRef} from 'react';
import type {Node} from '@react-types/shared';
import {fireEvent, render, screen, within} from '@testing-library/react';

import {useVirtualCollection, VirtualRows} from './useVirtualCollection';

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
  sectionRowGap,
}: {
  enabled: boolean;
  focusedKey?: string;
  items?: typeof nodes;
  sectionRowGap?: number;
}) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const {rows, spaceAfter} = useVirtualCollection({
    nodes: items,
    enabled,
    size: 'md',
    scrollRef,
    focusedKey,
    listPadding: LIST_PADDING,
    sectionRowGap,
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

describe('useVirtualCollection', () => {
  let offsetHeight: jest.SpyInstance;

  // jsdom does not lay out, so the viewport and every row would measure 0px.
  // Rows carry `data-index`; the element without it is the viewport.
  beforeEach(() => {
    offsetHeight = jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-index') ? ROW_HEIGHT : VIEWPORT_HEIGHT;
      });
  });

  afterEach(() => {
    offsetHeight.mockRestore();
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

  const sectioned = ['a', 'b'].flatMap(section => [
    {key: `section-${section}`, type: 'section', props: {}},
    ...Array.from({length: ROW_COUNT / 2}, (_, index) => ({
      key: `${section}-${index}`,
      type: 'item',
      parentKey: `section-${section}`,
      props: {},
    })),
  ]) as typeof nodes;

  it('keeps the section row of mounted rows mounted', () => {
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

  it('estimates the gap above unmounted section rows after the first', () => {
    const gap = 2;
    render(<TestList enabled items={sectioned} sectionRowGap={gap} />);

    const keys = screen.getAllByTestId('row').map(row => row.dataset.key);
    const isAfterFirst = (key: string) => /^[ab]-[1-9]/.test(key);
    // Mounted rows are measured, and jsdom applies no styles, so only the
    // unmounted rows after the first of their section add the gap.
    const unmountedAfterFirst = sectioned.filter(
      node => isAfterFirst(String(node.key)) && !keys.includes(String(node.key))
    ).length;
    expect(unmountedAfterFirst).toBeGreaterThan(0);

    const spanned = sum(spacerHeights()) + keys.length * ROW_HEIGHT;
    expect(spanned).toBe(sectioned.length * ROW_HEIGHT + unmountedAfterFirst * gap);
  });

  it('renders every row without measurement props when disabled', () => {
    render(<TestList enabled={false} />);

    const rendered = screen.getAllByTestId('row');
    expect(rendered).toHaveLength(ROW_COUNT);
    expect(rendered[0]).toHaveAttribute('data-row-props', 'unset');
    expect(sum(spacerHeights())).toBe(0);
  });
});

describe('VirtualRows', () => {
  it('renders each row inside its section, with spacers for unmounted rows', () => {
    const row = (key: string, type = 'item', parentKey?: string, spaceBefore = 0) => ({
      node: {key, type, parentKey} as (typeof nodes)[number],
      props: undefined,
      spaceBefore,
    });
    render(
      <ul>
        <VirtualRows
          virtual={{
            rows: [
              row('top'),
              row('section-a', 'section', undefined, 10),
              row('a-1', 'item', 'section-a'),
              row('a-2', 'item', 'section-a', 20),
              row('after'),
            ],
            spaceAfter: 30,
          }}
          renderRow={({node}) => <li data-test-id={node.key} />}
          renderSection={(section, rows) => (
            <li data-test-id={section.node.key}>
              <ul>{rows}</ul>
            </li>
          )}
        />
      </ul>
    );

    const section = screen.getByTestId('section-a');
    expect(within(section).getByTestId('a-1')).toBeInTheDocument();
    expect(within(section).getByTestId('a-2')).toBeInTheDocument();
    expect(within(section).queryByTestId('top')).not.toBeInTheDocument();
    expect(within(section).queryByTestId('after')).not.toBeInTheDocument();

    const spacers = screen
      .getAllByRole('presentation', {hidden: true})
      .map(spacer => spacer.style.height);
    expect(spacers).toEqual(['10px', '20px', '30px']);
  });
});
