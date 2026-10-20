import type * as React from 'react';
import {Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {act, render, screen, waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

/**
 * A section rendered behind a component boundary, which is what a tooltip
 * cannot see into.
 */
function SectionCard() {
  return <Tooltip.Header>test</Tooltip.Header>;
}

describe('Tooltip', () => {
  let originalResizeObserver: typeof window.ResizeObserver;

  function mockOverflow(width: number, containerWidth: number) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: containerWidth,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    originalResizeObserver = window.ResizeObserver;
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.clientWidth;
  });

  it('renders', async () => {
    render(
      <Tooltip title="test">
        <button>My Button</button>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    // Check that the arrow svg is rendered
    // These assertions verify the generated CSS targets and section DOM structure.
    // oxlint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('svg')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
    await waitFor(() => {
      expect(screen.queryByText('test')).not.toBeInTheDocument();
    });
  });

  it('updates title', async () => {
    const {rerender} = render(
      <Tooltip title="test">
        <button>My Button</button>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    // Change title
    rerender(
      <Tooltip title="bar">
        <button>My Button</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('bar')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
    await waitFor(() => {
      expect(screen.queryByText('bar')).not.toBeInTheDocument();
    });
  });

  it('disables and does not render', async () => {
    render(
      <Tooltip title="test" disabled>
        <button>My Button</button>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('resets visibility when becoming disabled', async () => {
    const {rerender} = render(
      <Tooltip title="test" disabled={false}>
        <button>My Button</button>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    rerender(
      <Tooltip title="test" disabled>
        <button>My Button</button>
      </Tooltip>
    );
    expect(screen.queryByText('test')).not.toBeInTheDocument();

    // Becomes enabled again
    rerender(
      <Tooltip title="test" disabled={false}>
        <button>My Button</button>
      </Tooltip>
    );
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('does not render an empty tooltip', async () => {
    render(
      <Tooltip title="">
        <button>My Button</button>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );
    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.getByText('My Button')).not.toHaveAttribute('aria-describedby');

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('displays a tooltip if the content overflows with showOnlyOnOverflow', async () => {
    // Mock this to return true because scrollWidth and clientWidth are 0 in JSDOM
    mockOverflow(100, 50);

    render(
      <Tooltip title="test" showOnlyOnOverflow>
        <div>This text overflows</div>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.hover(screen.getByText('This text overflows'));

    expect(screen.getByText('test')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('This text overflows'));
  });

  it('hides an open tooltip when the content stops overflowing', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    mockOverflow(100, 50);
    render(
      <Tooltip title="test" showOnlyOnOverflow>
        <div>This text changes size</div>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    const trigger = screen.getByText('This text changes size');
    await userEvent.hover(trigger);
    expect(screen.getByText('test')).toBeInTheDocument();

    mockOverflow(50, 100);
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.queryByText('test')).not.toBeInTheDocument();
    });
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('does not display a tooltip if the content does not overflow with showOnlyOnOverflow', async () => {
    mockOverflow(50, 100);

    render(
      <Tooltip title="test" showOnlyOnOverflow>
        <div>This text does not overflow</div>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.hover(screen.getByText('This text does not overflow'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('does not trigger the wrapping element when clicking tooltip content', async () => {
    const handleAncestorClick = jest.fn();

    render(
      <button type="button" onClick={handleAncestorClick}>
        <Tooltip title={<span>Copy</span>} forceVisible>
          <div>Trigger</div>
        </Tooltip>
      </button>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByText('Copy'));
    expect(handleAncestorClick).not.toHaveBeenCalled();
  });

  describe('section markers', () => {
    async function showTooltip(title: TooltipProps['title'] = 'test') {
      render(
        <Tooltip title={title}>
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );
      await userEvent.hover(screen.getByText('My Button'));

      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      const content = document.querySelector('[data-tooltip]');
      expect(content).toBeInTheDocument();
    }

    it('does not depend on a section being the overlay first child', async () => {
      // `Overlay` renders its arrow ahead of the content whenever arrowProps is
      // passed, which Tooltip always does. Keying the block-start cancel off
      // `:first-child` therefore silently never applies, which is why the rule
      // uses a preceding section instead.
      await showTooltip(<Tooltip.Header>test</Tooltip.Header>);

      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      const section = document.querySelector('[data-tooltip-section]');
      expect(section).toBeInTheDocument();
      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      expect(section).not.toBe(section!.parentElement!.firstElementChild);
    });

    it('marks a section composed directly into the title', async () => {
      await showTooltip(<Tooltip.Header>test</Tooltip.Header>);

      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      expect(document.querySelector('[data-tooltip-section]')).toBeInTheDocument();
    });

    it('marks sections a component of its own renders', async () => {
      // The case `TimeSince` is in. The sections are behind a component
      // boundary, but they are still the overlay's own children in the DOM,
      // which is what the rules above select on.
      await showTooltip(<SectionCard />);

      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      expect(document.querySelector('[data-tooltip-section]')).toBeInTheDocument();
    });

    it('leaves a plain sentence unmarked, so nothing is pulled out', async () => {
      await showTooltip('just a sentence');

      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      expect(document.querySelector('[data-tooltip-section]')).not.toBeInTheDocument();
    });
  });

  describe('sections', () => {
    it('renders a header label alongside its trailing value', async () => {
      render(
        <Tooltip
          title={<Tooltip.Header trailingItems="8mo ago">Last Seen</Tooltip.Header>}
        >
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(screen.getByText('Last Seen')).toBeInTheDocument();
      expect(screen.getByText('8mo ago')).toBeInTheDocument();
    });

    it('renders a footer label alongside its trailing value', async () => {
      render(
        <Tooltip
          title={<Tooltip.Footer trailingItems="UTC">Times shown in</Tooltip.Footer>}
        >
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(screen.getByText('Times shown in')).toBeInTheDocument();
      expect(screen.getByText('UTC')).toBeInTheDocument();
    });

    it('renders leading items before the label they belong to', async () => {
      render(
        <Tooltip
          title={
            <Fragment>
              <Tooltip.Header leadingItems={<span>header-icon</span>}>
                Last Seen
              </Tooltip.Header>
              <Tooltip.Footer leadingItems={<span>footer-icon</span>}>
                Times shown in
              </Tooltip.Footer>
            </Fragment>
          }
        >
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.hover(screen.getByText('My Button'));

      // Leading items are rendered as given rather than wrapped in text styles,
      // because they are usually a graphic.
      expect(screen.getByText('header-icon')).toBeInTheDocument();
      expect(screen.getByText('footer-icon')).toBeInTheDocument();
      expect(screen.getByText('header-icon').tagName).toBe('SPAN');
    });

    it('renders a row as its leading, main and trailing cells', async () => {
      render(
        <Tooltip
          title={
            <Tooltip.Grid columns="max-content 1fr max-content">
              <Tooltip.Row
                leadingItems={<span>PDT</span>}
                trailingItems={<span>11:40 PM</span>}
              >
                <span>Jul 28, 2026</span>
              </Tooltip.Row>
            </Tooltip.Grid>
          }
        >
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.hover(screen.getByText('My Button'));

      // All three land in the same grid, in the order the tracks expect.
      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      const row = screen.getByText('PDT').parentElement;
      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      expect(Array.from(row?.children ?? []).map(cell => cell.textContent)).toEqual([
        'PDT',
        'Jul 28, 2026',
        '11:40 PM',
      ]);
    });

    it('renders every row into the one body grid', async () => {
      render(
        <Tooltip
          title={
            <Tooltip.Grid columns="max-content 1fr">
              <Tooltip.Row>
                <span>PDT</span>
                <span>Jul 28, 2026</span>
              </Tooltip.Row>
              <Tooltip.Row>
                <span>UTC</span>
                <span>Jul 29, 2026</span>
              </Tooltip.Row>
            </Tooltip.Grid>
          }
        >
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.hover(screen.getByText('My Button'));

      // Sharing one grid is what keeps a column aligned between the rows when
      // one row's cell is wider than the other's.
      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      const firstRow = screen.getByText('PDT').parentElement;
      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      const secondRow = screen.getByText('UTC').parentElement;

      expect(firstRow).toBeInTheDocument();
      // These assertions verify the generated CSS targets and section DOM structure.
      // oxlint-disable-next-line testing-library/no-node-access
      expect(firstRow?.parentElement).toBe(secondRow?.parentElement);
    });

    it('stays described by its trigger', async () => {
      // Sections are the tooltip's content, so they must not disturb the
      // trigger/overlay association screen readers rely on.
      render(
        <Tooltip title={<Tooltip.Header>Last Seen</Tooltip.Header>}>
          <button>My Button</button>
        </Tooltip>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(screen.getByText('My Button')).toHaveAttribute('aria-describedby');
    });
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
