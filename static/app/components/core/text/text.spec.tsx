import {createRef, Fragment} from 'react';
import {expectTypeOf} from 'expect-type';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {
  Text,
  type TextProps,
  type TextPropsWithRenderFunction,
} from '@sentry/scraps/text';

const theme = ThemeFixture();

/** The `display` value of the always-applied base declaration (no at-rule). */
function getBaseDisplay(element: HTMLElement): string | undefined {
  const base = getEmotionRules(element).find(rule => rule.trimStart().startsWith('.'));
  return base?.match(/display:\s*([\w-]+)/)?.[1];
}

describe('Text', () => {
  it('Defaults to span', () => {
    render(<Text>Hello World</Text>);

    expect(screen.getByText('Hello World').tagName).toBe('SPAN');
  });

  it('renders with p as HTML element', () => {
    render(<Text as="p">Paragraph text</Text>);
    expect(screen.getByText('Paragraph text').tagName).toBe('P');
  });

  it('does not bleed props to the DOM element', () => {
    render(<Text align="center">Hello World</Text>);
    expect(screen.getByText('Hello World')).not.toHaveAttribute('align');
  });

  it('forwards data-test-id', () => {
    render(<Text data-test-id="test-id">Hello World</Text>);
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
      </Fragment>
    );
    expectTypeOf<TextProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('allows passing native HTML attributes', () => {
    render(
      <Text as="p" style={{color: 'red'}}>
        Paragraph text
      </Text>
    );
    expect(screen.getByText('Paragraph text')).toHaveStyle({color: 'red'});
  });

  it('assings ref', () => {
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Text as="p" ref={ref}>
        Paragraph text
      </Text>
    );
    expect(ref.current?.tagName).toBe('P');
  });

  it('does not allow color prop', () => {
    // @ts-expect-error: color is not a valid prop for Text
    render(<Text color="red">Hello World</Text>);
  });

  it('implements render prop', () => {
    render(
      <section>
        <Text variant="muted">{props => <p {...props}>Hello</p>}</Text>
      </section>
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
      </Text>
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
      </Text>
    );
  });

  describe('display', () => {
    it('emits no display for a plain span', () => {
      render(<Text>Hello World</Text>);
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBeUndefined();
    });

    it('defaults to block when as="div"', () => {
      render(<Text as="div">Hello World</Text>);
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('block');
    });

    it('forces block for ellipsis', () => {
      render(<Text ellipsis>Hello World</Text>);
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('block');
    });

    it('forces inline-block for an explicit span with ellipsis', () => {
      render(
        <Text as="span" ellipsis>
          Hello World
        </Text>
      );
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('inline-block');
    });

    it('applies a scalar display prop', () => {
      render(<Text display="none">Hello World</Text>);
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('none');
    });

    it('lets an explicit display prop override the as-derived default', () => {
      render(
        <Text as="div" display="inline">
          Hello World
        </Text>
      );
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('inline');
    });

    it('seeds the base breakpoint with the derived default for a responsive prop', () => {
      render(
        <Text as="div" display={{md: 'none'}}>
          Hello World
        </Text>
      );
      const element = screen.getByText('Hello World');
      // The default (block) fills the base so the div is not hidden below md...
      expect(getBaseDisplay(element)).toBe('block');
      // ...and the explicit value overrides it from md up.
      expect(getEmotionRules(element)).toContainEqual(
        expect.stringMatching(
          new RegExp(`@container \\(min-width: ${theme.container.md}\\).*display: none`)
        )
      );
    });

    it('seeds the base with the native block display for a responsive prop', () => {
      render(
        <Text as="p" display={{md: 'none'}}>
          Hello World
        </Text>
      );
      const element = screen.getByText('Hello World');
      // Without a derived default, the element's native display (block for <p>)
      // seeds the base so the paragraph is not hidden below md...
      expect(getBaseDisplay(element)).toBe('block');
      // ...and the explicit value overrides it from md up.
      expect(getEmotionRules(element)).toContainEqual(
        expect.stringMatching(
          new RegExp(`@container \\(min-width: ${theme.container.md}\\).*display: none`)
        )
      );
    });

    it('seeds the base with the native inline display for a responsive span', () => {
      render(<Text display={{md: 'none'}}>Hello World</Text>);
      // A span is inline by default, so it stays visible below md instead of
      // inheriting the `none` from the smallest specified breakpoint.
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('inline');
    });

    it('does not seed when the base breakpoint is explicitly set', () => {
      render(
        <Text as="div" display={{zero: 'none', md: 'block'}}>
          Hello World
        </Text>
      );
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('none');
    });

    it('preserves the align-required display below the smallest breakpoint', () => {
      render(
        <Text align="center" display={{md: 'inline'}}>
          Hello World
        </Text>
      );
      // align needs a block-level box; the derived block seeds the base.
      expect(getBaseDisplay(screen.getByText('Hello World'))).toBe('block');
    });

    it('is mutually exclusive with ellipsis', () => {
      render(
        // @ts-expect-error: display cannot be combined with ellipsis
        <Text ellipsis display="none">
          Hello World
        </Text>
      );
    });
  });

  describe('types', () => {
    it('default signature limits children to React.ReactNode', () => {
      const props: TextProps<'span'> = {children: 'hello'};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode>();
    });

    it('render prop signature limits children to (props: {className: string}) => React.ReactNode | undefined', () => {
      const props: TextPropsWithRenderFunction = {
        children: () => {},
      };
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {className: string}) => React.ReactNode | undefined
      >();
    });
  });
});
