import type * as React from 'react';
import {createRef, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {expectTypeOf} from 'expect-type';

import {
  Container,
  type ContainerProps,
  type ContainerPropsWithRenderFunction,
} from '@sentry/scraps/layout';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Hello</Container>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Container borderColor="primary">{props => <p {...props}>Hello</p>}</Container>
      </section>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');

    expect(screen.getByText('Hello')).not.toHaveAttribute('border', 'primary');
  });

  it('does not forward border props to the DOM', () => {
    render(
      <Container
        borderColor="transparent.neutral.muted"
        borderTopColor="danger.vibrant"
        borderWidth="xl"
      >
        Hello
      </Container>,
      {wrapper: ThemeWrapper}
    );

    const element = screen.getByText('Hello');
    expect(element).not.toHaveAttribute('borderColor');
    expect(element).not.toHaveAttribute('borderTopColor');
    expect(element).not.toHaveAttribute('borderWidth');
  });

  describe('borders', () => {
    const {border, tokens} = lightTheme;

    function renderBorder(props: React.ComponentProps<typeof Container>) {
      render(<Container {...props}>Hello</Container>, {wrapper: ThemeWrapper});
      return screen.getByText('Hello');
    }

    it('draws no border without border props', () => {
      expect(renderBorder({})).not.toHaveStyle({borderStyle: 'solid'});
    });

    it('defaults to a 1px width when only a color is set', () => {
      expect(renderBorder({borderColor: 'danger.vibrant'})).toHaveStyle({
        borderStyle: 'solid',
        borderWidth: border.md,
        borderColor: tokens.border.danger.vibrant,
      });
    });

    it('defaults to the primary color when only a width is set', () => {
      expect(renderBorder({borderWidth: 'xl'})).toHaveStyle({
        borderStyle: 'solid',
        borderWidth: border.xl,
        borderColor: tokens.border.primary,
      });
    });

    it('combines a color and a width', () => {
      expect(
        renderBorder({borderColor: 'accent.vibrant', borderWidth: '2xl'})
      ).toHaveStyle({
        borderStyle: 'solid',
        borderWidth: border['2xl'],
        borderColor: tokens.border.accent.vibrant,
      });
    });

    it('draws only the side whose color is set, at borderWidth', () => {
      expect(
        renderBorder({borderBottomColor: 'accent.vibrant', borderWidth: 'xl'})
      ).toHaveStyle({
        borderBottomStyle: 'solid',
        borderBottomColor: tokens.border.accent.vibrant,
        borderBottomWidth: border.xl,
        borderTopStyle: '',
      });
    });

    it('overrides one side of a full border', () => {
      expect(
        renderBorder({borderColor: 'primary', borderTopColor: 'danger.vibrant'})
      ).toHaveStyle({
        borderColor: `${tokens.border.danger.vibrant} ${tokens.border.primary} ${tokens.border.primary}`,
      });
    });

    it('removes a side with none', () => {
      expect(
        renderBorder({borderColor: 'primary', borderBottomColor: 'none'})
      ).toHaveStyle({borderTopStyle: 'solid', borderBottomStyle: 'none'});
    });
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Container borderColor="primary" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Container>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <p className={className}>Hello</p>;
    }

    render(
      <Container borderColor="primary">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Container>,
      {wrapper: ThemeWrapper}
    );
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Container as="label" htmlFor="test-id">
        Hello World
      </Container>,
      {wrapper: ThemeWrapper}
    );
    expectTypeOf<ContainerProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('passes attributes to the underlying element', () => {
    render(<Container data-test-id="container">Hello</Container>, {
      wrapper: ThemeWrapper,
    });
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Container as="section">Hello</Container>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Container radius="sm">Hello</Container>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('allows settings native html attributes', () => {
    render(<Container style={{color: 'red'}}>Hello</Container>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello')).toHaveStyle({color: 'rgb(255, 0, 0)'});
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Container ref={ref} as="ol">
        Hello
      </Container>,
      {wrapper: ThemeWrapper}
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <Fragment>
        <Container radius="sm" padding="md">
          Padding First
        </Container>
        <Container radius="sm" padding="md">
          PaddingBottom First
        </Container>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    const paddingFirst = screen.getByText('Padding First').className;
    const paddingBottomFirst = screen.getByText('PaddingBottom First').className;
    expect(paddingFirst).toEqual(paddingBottomFirst);
  });

  describe('types', () => {
    it('default signature limits children to React.ReactNode', () => {
      const props: ContainerProps<any> = {};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode | undefined>();
    });

    it('render prop signature limits children to (props: {className: string}) => React.ReactNode | undefined', () => {
      const props: ContainerPropsWithRenderFunction<any> = {children: () => {}};
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {className: string}) => React.ReactNode | undefined
      >();
    });

    it('forbids declaring a query container with a render prop', () => {
      const withContainerType: ContainerPropsWithRenderFunction<any> = {
        children: () => null,
        // @ts-expect-error - containerType is not allowed with a render prop
        containerType: 'inline-size',
      };

      expectTypeOf(withContainerType).toBeObject();
    });
  });
});
