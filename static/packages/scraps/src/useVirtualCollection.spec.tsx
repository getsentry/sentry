import {useRef} from 'react';
import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import type {Node} from '@react-types/shared';
import {fireEvent, render, screen, within} from '@testing-library/react';

import {Container} from '@sentry/scraps/layout';
import {ListItem} from '@sentry/scraps/menu';
import {lightTheme} from '@sentry/scraps/theme';

import {useVirtualCollection, VirtualRows, type VirtualRow} from './useVirtualCollection';

// jsdom does not lay out, so these tests stub the viewport and row heights and
// check what the hook promises regardless of them: unmounted space plus mounted
// rows always add up to the full list. Which rows mount, and how unmounted rows
// are estimated, is covered without a DOM in virtualCollectionLayout.spec.ts.
// Keyboard and focus behavior is covered through the real DropdownMenu and
// CompactSelect specs.
const ROW_COUNT = 300;
const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 100;
const LIST_PADDING = 4;

const nodes = Array.from(
  {length: ROW_COUNT},
  (_, index) =>
    ({key: `row-${index}`, type: 'item', props: {}}) as Node<Record<PropertyKey, unknown>>
);

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function TestList({
  collection = nodes,
  estimateSize,
  focusedKey,
  renderSection,
}: {
  collection?: Array<Node<Record<PropertyKey, unknown>>>;
  estimateSize?: (node: Node<Record<PropertyKey, unknown>>, index: number) => number;
  focusedKey?: string;
  renderSection?: (
    section: VirtualRow<Record<PropertyKey, unknown>>,
    rows: React.ReactNode
  ) => React.ReactNode;
}) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const virtual = useVirtualCollection({
    collection,
    estimateSize,
    enabled: true,
    scrollRef,
    focusedKey,
    listPadding: LIST_PADDING,
  });

  return (
    <Container as="ul" ref={scrollRef} aria-label="Rows">
      <VirtualRows
        virtual={virtual}
        renderRow={({node, props}) => <ListItem label={String(node.key)} {...props} />}
        renderSection={renderSection}
      />
    </Container>
  );
}

/** Heights of the spacers standing in for unmounted rows. */
function spacerHeights() {
  return screen
    .queryAllByRole('presentation', {hidden: true})
    .map(spacer => parseFloat(getComputedStyle(spacer).height || '0'));
}

/** Keys of the mounted rows, in render order. */
function mountedKeys() {
  return screen.getAllByRole('listitem').map(row => row.textContent);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

describe('useVirtualCollection', () => {
  let offsetHeight: jest.SpyInstance;

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

  it('mounts a window of rows and fills the rest of the list with spacers', () => {
    render(<TestList />, {wrapper: ThemeWrapper});

    const keys = mountedKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.length).toBeLessThan(ROW_COUNT);

    // The list's own padding is CSS, so spacers and rows add up to the rows'
    // height alone.
    expect(sum(spacerHeights()) + keys.length * ROW_HEIGHT).toBe(ROW_COUNT * ROW_HEIGHT);
  });

  it('mounts rows when the list is only as tall as its content', () => {
    // Like DropdownMenu's list, which has no padding: before any row mounts,
    // its height comes from the spacers alone.
    offsetHeight.mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-index')) {
        return ROW_HEIGHT;
      }
      const content =
        sum(spacerHeights()) + screen.queryAllByRole('listitem').length * ROW_HEIGHT;
      return Math.min(VIEWPORT_HEIGHT, content);
    });

    render(<TestList />, {wrapper: ThemeWrapper});

    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('mounts no more rows than fit in the window while the list is unbounded', () => {
    // A menu's list has no height limit until its overlay is positioned, so on
    // its first render it can be as tall as all of its rows.
    offsetHeight.mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-index') ? ROW_HEIGHT : ROW_COUNT * ROW_HEIGHT;
    });

    render(<TestList />, {wrapper: ThemeWrapper});

    const rowsInWindow = Math.ceil(window.innerHeight / ROW_HEIGHT);
    expect(mountedKeys().length).toBeGreaterThan(0);
    // Allow for the overscan rows on either side of the window.
    expect(mountedKeys().length).toBeLessThanOrEqual(rowsInWindow + 2);
  });

  it('keeps the focused row mounted, and the list its full height, after scrolling', () => {
    render(<TestList focusedKey="row-0" />, {wrapper: ThemeWrapper});

    const list = screen.getByRole('list', {name: 'Rows'});
    list.scrollTop = 150 * ROW_HEIGHT;
    fireEvent.scroll(list);

    const keys = mountedKeys();
    expect(keys).toContain('row-0');
    expect(keys).toContain('row-150');
    expect(keys).not.toContain('row-1');

    // A spacer fills the gap between the focused row and the window.
    expect(sum(spacerHeights()) + keys.length * ROW_HEIGHT).toBe(ROW_COUNT * ROW_HEIGHT);
  });

  it('estimates unmounted rows with estimateSize', () => {
    const estimate = 50;
    render(<TestList estimateSize={() => estimate} />, {wrapper: ThemeWrapper});

    const keys = mountedKeys();
    expect(sum(spacerHeights())).toBe((ROW_COUNT - keys.length) * estimate);
  });

  it('keeps measured row heights when the collection and estimateSize are rebuilt', () => {
    // Like a menu whose items are rebuilt when one of them changes, such as a
    // project being bookmarked: the rows keep their keys and heights.
    const estimate = 50;
    const {rerender} = render(<TestList estimateSize={() => estimate} />, {
      wrapper: ThemeWrapper,
    });

    // Rows measured at the top keep their height once scrolled out of view.
    const list = screen.getByRole('list', {name: 'Rows'});
    list.scrollTop = 150 * estimate;
    fireEvent.scroll(list);
    const spaceBefore = spacerHeights();

    rerender(<TestList collection={[...nodes]} estimateSize={() => estimate} />);

    expect(spacerHeights()).toEqual(spaceBefore);
  });

  it('windows the children of a section as rows of their own', () => {
    const children = nodes.map(node => ({...node, parentKey: 'section'}));
    const section = {
      key: 'section',
      type: 'section',
      props: {},
      childNodes: children,
    } as unknown as Node<Record<PropertyKey, unknown>>;

    render(
      <TestList
        collection={[section]}
        renderSection={(sectionRow, rows) => (
          <li {...sectionRow.props} aria-label={String(sectionRow.node.key)}>
            <ul>{rows}</ul>
          </li>
        )}
      />,
      {wrapper: ThemeWrapper}
    );

    const group = screen.getByRole('listitem', {name: 'section'});
    const rows = within(group).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(ROW_COUNT);
    expect(rows[0]).toHaveTextContent('row-0');
  });
});
