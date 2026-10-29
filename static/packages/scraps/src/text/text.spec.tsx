import type * as React from 'react';
import {createRef, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {expectTypeOf} from 'expect-type';

import {lightTheme as theme} from '@sentry/scraps/theme';

import {Text, type TextProps, type TextPropsWithRenderFunction} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

describe('Text', () => {
  it('Defaults to span', () => {
    render(<Text>Hello World</Text>, {wrapper: ThemeWrapper});

    expect(screen.getByText('Hello World').tagName).toBe('SPAN');
  });

  it('renders with p as HTML element', () => {
    render(<Text as="p">Paragraph text</Text>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Paragraph text').tagName).toBe('P');
  });

  it('does not bleed props to the DOM element', () => {
    render(<Text align="center">Hello World</Text>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello World')).not.toHaveAttribute('align');
  });

  it('does not forward trim to the DOM element', () => {
    render(<Text trim={false}>Hello World</Text>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello World')).not.toHaveAttribute('trim');
  });

  it('forwards data-test-id', () => {
    render(<Text data-test-id="test-id">Hello World</Text>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello World')).toHaveAttribute('data-test-id', 'test-id');
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Fragment>
        {/* @ts-expect-error: htmlFor is not a valid prop for Text */}
        <Text htmlFor="test-id">Hello World</Text>
        <Text as="label" htmlFor="test-id">
          Hello World
        </Text>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );
    expectTypeOf<TextProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('allows passing native HTML attributes', () => {
    render(
      <Text as="p" style={{color: 'red'}}>
        Paragraph text
      </Text>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByText('Paragraph text')).toHaveStyle({color: 'rgb(255, 0, 0)'});
  });

  it('assings ref', () => {
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Text as="p" ref={ref}>
        Paragraph text
      </Text>,
      {wrapper: ThemeWrapper}
    );
    expect(ref.current?.tagName).toBe('P');
  });

  it('does not allow color prop', () => {
    // @ts-expect-error: color is not a valid prop for Text
    render(<Text color="red">Hello World</Text>, {wrapper: ThemeWrapper});
  });

  it('implements render prop', () => {
    render(
      <section>
        <Text variant="muted">{props => <p {...props}>Hello</p>}</Text>
      </section>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');

    expect(screen.getByText('Hello')).not.toHaveAttribute('variant', 'muted');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Text variant="muted" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Text>,
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
      <Text variant="muted">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Text>,
      {wrapper: ThemeWrapper}
    );
  });

  describe('display', () => {
    it('is mutually exclusive with ellipsis', () => {
      render(
        // @ts-expect-error: display cannot be combined with ellipsis
        <Text ellipsis display="none">
          Hello World
        </Text>,
        {wrapper: ThemeWrapper}
      );
    });
  });

  describe('types', () => {
    it('default signature limits children to React.ReactNode', () => {
      const props: TextProps<'span'> = {children: 'hello'};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode>();
    });

    it('render prop signature limits children to (props: {className: string; style?: React.CSSProperties}) => React.ReactNode | undefined', () => {
      const props: TextPropsWithRenderFunction = {
        children: () => {},
      };
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {
          className: string;
          style?: React.CSSProperties;
        }) => React.ReactNode | undefined
      >();
    });
  });
});
