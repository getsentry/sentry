import {Fragment} from 'react';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Container} from '@sentry/scraps/layout';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

const theme = ThemeFixture();

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

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.clientWidth;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    originalResizeObserver = window.ResizeObserver;
  });

  it('renders', async () => {
    render(
      <Tooltip title="test">
        <button>My Button</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    // Check that the arrow svg is rendered
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
      </Tooltip>
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
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('resets visibility when becoming disabled', async () => {
    const {rerender} = render(
      <Tooltip title="test" disabled={false}>
        <button>My Button</button>
      </Tooltip>
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
      </Tooltip>
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
      </Tooltip>
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
      </Tooltip>
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
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('This text does not overflow'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('does not trigger the wrapping element when clicking tooltip content', async () => {
    const handleAncestorClick = jest.fn();

    render(
      <button type="button" onClick={handleAncestorClick}>
        <Tooltip title={<span>Copy</span>} isHoverable forceVisible>
          <div>Trigger</div>
        </Tooltip>
      </button>
    );

    await userEvent.click(screen.getByText('Copy'));
    expect(handleAncestorClick).not.toHaveBeenCalled();
  });

  describe('content padding', () => {
    // `getComputedStyle` is stubbed in tests/js/setup.ts and cannot see emotion
    // rules, so the overlay's own rules are read from the generated CSS. What
    // those rules select on -- the section marker -- is asserted against the DOM
    // separately, since jsdom does no layout.
    async function showTooltip(title: TooltipProps['title'] = 'test') {
      render(
        <Tooltip title={title}>
          <button>My Button</button>
        </Tooltip>
      );
      await userEvent.hover(screen.getByText('My Button'));

      const content = document.querySelector('[data-tooltip]');
      expect(content).toBeInTheDocument();

      return content as HTMLElement;
    }

    it('pads the content by default', async () => {
      // Every tooltip that is not built from sections depends on this, so it is
      // the regression guard for the existing call sites.
      const rules = getEmotionRules(await showTooltip()).join('');

      expect(rules).toContain(`padding: ${theme.space.md} ${theme.space.lg};`);
    });

    it('pulls sections back out to the overlay edges', async () => {
      const rules = getEmotionRules(await showTooltip()).join('');

      expect(rules).toMatch(
        />\s*\[data-tooltip-section\]\s*{[^}]*margin-inline:\s*calc\(-1 \*/
      );
    });

    it('cancels the block padding at the ends only', async () => {
      // Every section doing this would collapse the space between two of them.
      const rules = getEmotionRules(await showTooltip()).join('');

      expect(rules).toMatch(
        /\[data-tooltip-section\]\s*~\s*\[data-tooltip-section\]\s*{[^}]*margin-block-start:\s*0/
      );
      expect(rules).toMatch(/:last-child\s*{[^}]*margin-block-end:\s*calc\(-1 \*/);
    });

    it('does not depend on a section being the overlay first child', async () => {
      // `Overlay` renders its arrow ahead of the content whenever arrowProps is
      // passed, which Tooltip always does. Keying the block-start cancel off
      // `:first-child` therefore silently never applies, which is why the rule
      // above selects on a preceding section instead.
      await showTooltip(<Tooltip.Header>test</Tooltip.Header>);

      const section = document.querySelector('[data-tooltip-section]');
      expect(section).toBeInTheDocument();
      expect(section).not.toBe(section!.parentElement!.firstElementChild);
    });

    it('marks a section composed directly into the title', async () => {
      await showTooltip(<Tooltip.Header>test</Tooltip.Header>);

      expect(document.querySelector('[data-tooltip-section]')).toBeInTheDocument();
    });

    it('marks sections a component of its own renders', async () => {
      // The case `TimeSince` is in. The sections are behind a component
      // boundary, but they are still the overlay's own children in the DOM,
      // which is what the rules above select on.
      await showTooltip(<SectionCard />);

      expect(document.querySelector('[data-tooltip-section]')).toBeInTheDocument();
    });

    it('leaves a plain sentence unmarked, so nothing is pulled out', async () => {
      await showTooltip('just a sentence');

      expect(document.querySelector('[data-tooltip-section]')).not.toBeInTheDocument();
    });

    it('reads a grid from the left, undoing the overlay centring', async () => {
      // The overlay centres text for the sentence case. A card is a set of
      // rows, so the grid resets it and cells only state an alignment when
      // they want something other than left.
      await showTooltip(
        <Tooltip.Grid>
          <Tooltip.Row>cell</Tooltip.Row>
        </Tooltip.Grid>
      );

      const grid = document.querySelector('[data-tooltip-section]');
      expect(getEmotionRules(grid as HTMLElement).join('')).toContain(
        'text-align: left;'
      );
    });
  });

  describe('sections', () => {
    it('renders a header label alongside its trailing value', async () => {
      render(
        <Tooltip
          title={<Tooltip.Header trailingItems="8mo ago">Last Seen</Tooltip.Header>}
        >
          <button>My Button</button>
        </Tooltip>
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
        </Tooltip>
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
        </Tooltip>
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
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      // All three land in the same grid, in the order the tracks expect.
      const row = screen.getByText('PDT').parentElement;
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
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      // Sharing one grid is what keeps a column aligned between the rows when
      // one row's cell is wider than the other's.
      const firstRow = screen.getByText('PDT').parentElement;
      const secondRow = screen.getByText('UTC').parentElement;

      expect(firstRow).toBeInTheDocument();
      expect(firstRow?.parentElement).toBe(secondRow?.parentElement);
    });

    it('stays described by its trigger', async () => {
      // Sections are the tooltip's content, so they must not disturb the
      // trigger/overlay association screen readers rely on.
      render(
        <Tooltip title={<Tooltip.Header>Last Seen</Tooltip.Header>}>
          <button>My Button</button>
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(screen.getByText('My Button')).toHaveAttribute('aria-describedby');
    });

    it('renders a row as a layout-less wrapper so its cells join that grid', async () => {
      // A row that established its own layout box would align its columns only
      // against itself, so what it renders has to stay `display: contents`.
      // Same class as the reference means the same serialized styles.
      const reference = render(
        <Container display="contents">
          <span>reference cell</span>
        </Container>
      );
      const referenceClassName =
        screen.getByText('reference cell').parentElement?.className;
      reference.unmount();

      render(
        <Tooltip
          title={
            <Tooltip.Grid>
              <Tooltip.Row>
                <span>row cell</span>
              </Tooltip.Row>
            </Tooltip.Grid>
          }
        >
          <button>My Button</button>
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(referenceClassName).toBeTruthy();
      expect(screen.getByText('row cell').parentElement?.className).toBe(
        referenceClassName
      );
    });
  });
});
