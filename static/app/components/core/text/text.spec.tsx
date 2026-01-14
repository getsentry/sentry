import {createRef, Fragment} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TextProps} from './text';
import {Text} from './text';

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
});
