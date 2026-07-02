import {createRef, Fragment} from 'react';
import {expectTypeOf} from 'expect-type';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {
  Stack,
  type StackProps,
  type StackPropsWithRenderFunction,
} from '@sentry/scraps/layout';
import type {Responsive} from '@sentry/scraps/layout';

const theme = ThemeFixture();

// A matchMedia mock that tracks listeners so tests can drive breakpoint changes.
function setupTrackedMatchMedia(initialMatches: (query: string) => boolean) {
  const listeners: Record<string, Array<() => void>> = {};
  const queries: Record<string, {matches: boolean}> = {};

  window.matchMedia = jest.fn((query: string) => {
    const mock = {
      matches: initialMatches(query),
      media: query,
      addEventListener: jest.fn((_event: string, listener: () => void) => {
        (listeners[query] ??= []).push(listener);
      }),
      removeEventListener: jest.fn((_event: string, listener: () => void) => {
        listeners[query] = (listeners[query] ?? []).filter(l => l !== listener);
      }),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
      onchange: null,
    };
    queries[query] = mock;
    return mock;
  });

  return {
    setMatches(query: string, matches: boolean) {
      if (queries[query]) {
        queries[query].matches = matches;
      }
      (listeners[query] ?? []).forEach(listener => listener());
    },
  };
}

describe('Stack', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders children', () => {
    render(<Stack>Hello</Stack>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Stack justify="between">{props => <p {...props}>Hello</p>}</Stack>
      </section>
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Stack justify="between" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Stack>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <p className={className}>Hello</p>;
    }

    render(
      <Stack justify="between" padding="md">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Stack>
    );
  });

  it('passes attributes to the underlying element', () => {
    render(<Stack data-test-id="container">Hello</Stack>);
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Stack as="section">Hello</Stack>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Stack radius="sm">Hello</Stack>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('does not bleed stack attributes to the underlying element', () => {
    render(
      <Stack align="center" justify="center" gap="md">
        Hello
      </Stack>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('align');
    expect(screen.getByText('Hello')).not.toHaveAttribute('justify');
    expect(screen.getByText('Hello')).not.toHaveAttribute('gap');
    expect(screen.getByText('Hello')).not.toHaveAttribute('direction');
  });

  it('allows settings native html attributes', () => {
    render(<Stack style={{color: 'red'}}>Hello</Stack>);
    expect(screen.getByText('Hello')).toHaveStyle({color: 'red'});
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Stack as="label" htmlFor="test-id">
        Hello World
      </Stack>
    );
    expectTypeOf<StackProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Stack ref={ref} as="ol">
        Hello
      </Stack>
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <Fragment>
        <Stack radius="sm" padding="md">
          First Stack
        </Stack>
        <Stack radius="sm" padding="md">
          Second Stack
        </Stack>
      </Fragment>
    );

    const firstStack = screen.getByText('First Stack').className;
    const secondStack = screen.getByText('Second Stack').className;
    expect(firstStack).toEqual(secondStack);
  });

  it('row orientation = vertical separator', () => {
    render(
      <Stack direction="row">
        <div>Item 1</div>
        <Stack.Separator />
      </Stack>
    );

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('column orientation = horizontal separator', () => {
    render(
      <Stack direction="column">
        <div>Item 1</div>
        <Stack.Separator />
      </Stack>
    );

    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
  });

  it('does not re-render on a breakpoint change when it has no separator', () => {
    const matchMedia = setupTrackedMatchMedia(() => false);

    let renderCount = 0;
    function Probe() {
      renderCount++;
      return <span>probe</span>;
    }

    render(
      <Stack>
        <Probe />
      </Stack>
    );

    const initialRenderCount = renderCount;

    // A Stack without a separator must not subscribe to breakpoint changes, so
    // crossing a breakpoint should not re-render its subtree.
    act(() => {
      matchMedia.setMatches(`(min-width: ${theme.breakpoints.lg})`, true);
    });

    expect(renderCount).toBe(initialRenderCount);
  });

  it('updates separator orientation reactively when the breakpoint changes', () => {
    const matchMedia = setupTrackedMatchMedia(() => false);

    render(
      <Stack direction={{'screen:2xs': 'column', 'screen:lg': 'row'}}>
        <div>Item</div>
        <Stack.Separator />
      </Stack>
    );

    // 2xs (nothing matches) => column => horizontal separator
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );

    act(() => {
      matchMedia.setMatches(`(min-width: ${theme.breakpoints.lg})`, true);
    });

    // lg => row => vertical separator
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  describe('types', () => {
    it('has a limited display prop', () => {
      const props: StackProps<any> = {};
      expectTypeOf(props.display).toEqualTypeOf<
        Responsive<'flex' | 'inline-flex' | 'none'> | undefined
      >();
    });

    it('default signature limits children to React.ReactNode', () => {
      const props: StackProps<any> = {};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode | undefined>();
    });
    it('render prop signature limits children to (props: {className: string}) => React.ReactNode | undefined', () => {
      const props: StackPropsWithRenderFunction<any> = {
        children: () => {},
      };
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {className: string}) => React.ReactNode | undefined
      >();
    });
  });
});
