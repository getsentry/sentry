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
    // rules, so read the generated CSS rather than using toHaveStyle, which
    // would pass vacuously against an empty declaration.
    async function contentRules(
      padding?: TooltipProps['padding'],
      title: TooltipProps['title'] = 'test'
    ) {
      render(
        <Tooltip title={title} padding={padding}>
          <button>My Button</button>
        </Tooltip>
      );
      await userEvent.hover(screen.getByText('My Button'));

      // The overlay itself, not the text inside it — a section title nests the
      // text a few levels down, so it is not the element carrying the padding.
      const content = document.querySelector('[data-tooltip]');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('test');

      return getEmotionRules(content as HTMLElement).join('');
    }

    it('pads the content by default', async () => {
      // Every tooltip that has not opted out depends on this, so it is the
      // regression guard for the existing call sites.
      expect(await contentRules()).toContain(
        `padding: ${theme.space.md} ${theme.space.lg};`
      );
    });

    it('drops the content padding when opted out', async () => {
      expect(await contentRules('0')).toContain(`padding: ${theme.space['0']};`);
    });

    it('keeps the padding when the title composes sections', async () => {
      // Sections pad themselves, so a tooltip built from them wants `'0'`. It
      // is passed rather than inferred: inferring it would mean inspecting
      // children, which cannot see sections behind a component boundary anyway.
      expect(
        await contentRules(undefined, <Tooltip.Header>test</Tooltip.Header>)
      ).toContain(`padding: ${theme.space.md} ${theme.space.lg};`);
    });

    it('lets a component that renders sections opt out with the prop', async () => {
      expect(await contentRules('0', <SectionCard />)).toContain(
        `padding: ${theme.space['0']};`
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
