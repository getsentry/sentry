import {createRef} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Heading, type HeadingProps, type HeadingPropsWithRenderFunction} from './';

describe('Heading', () => {
  it('renders with correct HTML element', () => {
    render(
      <Heading as="h6" align="center">
        Heading 6
      </Heading>
    );
    expect(screen.getByText('Heading 6').tagName).toBe('H6');
  });

  it('does not bleed props to the DOM element', () => {
    render(
      <Heading as="h6" align="center">
        Heading 6
      </Heading>
    );
    expect(screen.getByText('Heading 6')).not.toHaveAttribute('align');
  });

  it('forwards data-test-id', () => {
    render(
      <Heading as="h6" data-test-id="test-id">
        Heading 6
      </Heading>
    );
    expect(screen.getByText('Heading 6')).toHaveAttribute('data-test-id', 'test-id');
  });
  it('allows passing native HTML attributes', () => {
    render(
      <Heading as="h6" style={{color: 'red'}}>
        Heading 6
      </Heading>
    );
    expect(screen.getByText('Heading 6')).toHaveStyle({color: 'red'});
  });
  it('assings ref', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <Heading as="h6" ref={ref}>
        Heading 6
      </Heading>
    );
    expect(ref.current?.tagName).toBe('H6');
  });

  it('implements render prop', () => {
    render(
      <section>
        <Heading variant="muted">{props => <h2 {...props}>Title</h2>}</Heading>
      </section>
    );

    expect(screen.getByText('Title')?.tagName).toBe('H2');
    expect(screen.getByText('Title').parentElement?.tagName).toBe('SECTION');

    expect(screen.getByText('Title')).not.toHaveAttribute('variant', 'muted');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Heading variant="muted" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <h2 {...props}>Title</h2>}
      </Heading>
    );

    expect(screen.getByText('Title')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <h2 className={className}>Title</h2>;
    }

    render(
      <Heading variant="muted">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Heading>
    );
  });

  describe('types', () => {
    it('default signature requires as and limits children to React.ReactNode', () => {
      const props: HeadingProps = {as: 'h1', children: 'Title'};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode>();
    });

    it('render prop signature limits children to (props: {className: string}) => React.ReactNode | undefined', () => {
      const props: HeadingPropsWithRenderFunction = {
        children: () => undefined,
      };
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {className: string}) => React.ReactNode | undefined
      >();
    });
  });
});
