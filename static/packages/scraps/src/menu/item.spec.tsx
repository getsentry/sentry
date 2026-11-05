import type * as React from 'react';
import {createRef, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {useFloating} from '@floating-ui/react-dom';
import {render, screen} from '@testing-library/react';
import {expectTypeOf} from 'expect-type';

import {ListItem, ReserveLeadingSlot} from '@sentry/scraps/menu';
import {darkTheme, lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

jest.mock('@floating-ui/react-dom', () => ({
  ...jest.requireActual('@floating-ui/react-dom'),
  useFloating: jest.fn(),
}));

describe('ListItem', () => {
  beforeEach(() => {
    jest
      .mocked(useFloating)
      .mockImplementation(({placement = 'bottom', strategy = 'absolute'} = {}) => ({
        x: 0,
        y: 0,
        placement,
        strategy,
        middlewareData: {},
        isPositioned: false,
        update: jest.fn(),
        refs: {
          reference: {current: null},
          floating: {current: null},
          setReference: jest.fn(),
          setFloating: jest.fn(),
        },
        elements: {reference: null, floating: null},
        floatingStyles: {position: strategy, left: 0, top: 0},
      }));
  });

  describe.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('%s theme interaction backgrounds', (_, theme) => {
    const background = theme.tokens.interactive.transparent.neutral.background;

    it.each([
      {isFocused: false, isPressed: false, disabled: false, state: 'rest'},
      {isFocused: true, isPressed: false, disabled: false, state: 'hover'},
      {isFocused: false, isPressed: true, disabled: false, state: 'active'},
      {isFocused: true, isPressed: true, disabled: false, state: 'active'},
      {isFocused: true, isPressed: true, disabled: true, state: 'rest'},
    ] as const)('uses the $state background for %j', ({state, ...props}) => {
      render(
        <ThemeProvider theme={theme}>
          <ListItem label="Action" innerWrapProps={{role: 'menuitem'}} {...props} />
        </ThemeProvider>
      );

      expect(screen.getByRole('menuitem')).toHaveStyle({
        background:
          state === 'rest'
            ? background.rest
            : `linear-gradient(${background[state]}, ${background[state]}), ${theme.tokens.background.overlay}`,
      });
    });

    it.each(['default', 'primary', 'danger'] as const)(
      'keeps neutral feedback and the %s text color',
      priority => {
        render(
          <ThemeProvider theme={theme}>
            <ListItem
              label="Action"
              priority={priority}
              isFocused
              innerWrapProps={{role: 'menuitem'}}
            />
          </ThemeProvider>
        );

        expect(screen.getByRole('menuitem')).toHaveStyle({
          background: `linear-gradient(${background.hover}, ${background.hover}), ${theme.tokens.background.overlay}`,
          color:
            priority === 'primary'
              ? theme.tokens.content.accent
              : priority === 'danger'
                ? theme.tokens.content.danger
                : theme.tokens.content.primary,
        });
      }
    );

    it.each([
      {isPressed: undefined, state: 'active'},
      {isPressed: false, state: 'hover'},
    ] as const)(
      'uses $state for an expanded item with isPressed=$isPressed',
      ({isPressed, state}) => {
        render(
          <ThemeProvider theme={theme}>
            <ListItem
              label="Action"
              isFocused
              isPressed={isPressed}
              innerWrapProps={{role: 'menuitem', 'aria-expanded': true}}
            />
          </ThemeProvider>
        );

        expect(screen.getByRole('menuitem')).toHaveStyle({
          background: `linear-gradient(${background[state]}, ${background[state]}), ${theme.tokens.background.overlay}`,
        });
      }
    );
  });

  it('attaches the ref to the default li wrapper', () => {
    const ref = createRef<HTMLLIElement>();

    render(<ListItem label="Action" ref={ref} />, {wrapper: ThemeWrapper});

    expect(ref.current?.tagName).toBe('LI');
    expect(ref.current).toContainElement(screen.getByText('Action'));
  });

  it('attaches the ref to the specified wrapper', () => {
    const ref = createRef<HTMLDivElement>();

    render(<ListItem as="div" label="Action" ref={ref} />, {wrapper: ThemeWrapper});

    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current).toContainElement(screen.getByText('Action'));
  });

  it('infers the ref type from the wrapper element', () => {
    render(
      <Fragment>
        <ListItem
          label="Default"
          ref={element => {
            expectTypeOf(element).toEqualTypeOf<HTMLLIElement | null>();
          }}
        />
        <ListItem
          as="div"
          label="Action"
          ref={element => {
            expectTypeOf(element).toEqualTypeOf<HTMLDivElement | null>();
          }}
        />
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    expectTypeOf<Parameters<typeof ListItem<'li'>>[0]['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<Parameters<typeof ListItem<'div'>>[0]['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
  });

  it('reserves an empty leading slot so labels line up with items that have icons', () => {
    /* oxlint-disable testing-library/no-node-access -- Leading slots are decorative layout without an accessible role. */
    function getContentChildCount(label: string) {
      return screen
        .getByText(label)
        .closest('[data-menu-item-content]')
        ?.querySelectorAll(':scope > *').length;
    }
    /* oxlint-enable testing-library/no-node-access */

    const {rerender} = render(
      <Fragment>
        <ListItem label="With icon" leadingItems={<span>icon</span>} />
        <ListItem label="Plain" />
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    expect(getContentChildCount('Plain')).toBeLessThan(
      getContentChildCount('With icon')!
    );

    rerender(
      <ReserveLeadingSlot reserve>
        <ListItem label="With icon" leadingItems={<span>icon</span>} />
        <ListItem label="Plain" />
      </ReserveLeadingSlot>
    );

    expect(getContentChildCount('Plain')).toBe(getContentChildCount('With icon'));
  });

  it('positions the details overlay against an item that mounts focused', () => {
    const ref = createRef<HTMLLIElement>();

    render(
      <ListItem label="Action" details="More" showDetailsInOverlay isFocused ref={ref} />,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('More');
    expect(useFloating).toHaveBeenLastCalledWith(
      expect.objectContaining({elements: {reference: ref.current}})
    );
  });

  it('positions the details overlay against an item focused after mounting', () => {
    const ref = createRef<HTMLLIElement>();

    const {rerender} = render(
      <ListItem label="Action" details="More" showDetailsInOverlay ref={ref} />,
      {wrapper: ThemeWrapper}
    );
    rerender(
      <ListItem label="Action" details="More" showDetailsInOverlay isFocused ref={ref} />
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('More');
    expect(useFloating).toHaveBeenLastCalledWith(
      expect.objectContaining({elements: {reference: ref.current}})
    );
  });
});
