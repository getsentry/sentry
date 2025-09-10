import {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Heading} from './';

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

  it('accepts textWrap prop without errors', () => {
    // Test that the component accepts the textWrap prop without TypeScript errors
    expect(() => {
      render(
        <Heading as="h1" textWrap="balance">
          Balanced heading
        </Heading>
      );
    }).not.toThrow();
    expect(screen.getByText('Balanced heading')).toBeInTheDocument();
  });

  it('does not bleed textWrap prop to DOM', () => {
    render(
      <Heading as="h2" textWrap="pretty">
        Pretty heading
      </Heading>
    );
    const headingElement = screen.getByText('Pretty heading');
    expect(headingElement).not.toHaveAttribute('textWrap');
  });
});
