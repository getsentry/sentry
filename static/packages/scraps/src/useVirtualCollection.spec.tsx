import {useRef} from 'react';
import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import type {Node} from '@react-types/shared';
import {fireEvent, render, screen} from '@testing-library/react';

import {Container} from '@sentry/scraps/layout';
import {ListItem} from '@sentry/scraps/menu';
import {lightTheme} from '@sentry/scraps/theme';

import {useVirtualCollection, VirtualRows} from './useVirtualCollection';

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

function TestList({focusedKey}: {focusedKey?: string}) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const virtual = useVirtualCollection({
    nodes,
    enabled: true,
    size: 'md',
    scrollRef,
    focusedKey,
    listPadding: LIST_PADDING,
  });

  return (
    <Container as="ul" ref={scrollRef} aria-label="Rows">
      <VirtualRows
        virtual={virtual}
        renderRow={({node, props}) => <ListItem label={String(node.key)} {...props} />}
        renderSection={(_section, rows) => rows}
      />
    </Container>
  );
}

/** Heights of the spacers standing in for unmounted rows. */
function spacerHeights() {
  return screen
    .queryAllByRole('presentation', {hidden: true})
    .map(spacer => parseFloat(spacer.style.height || '0'));
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
});
