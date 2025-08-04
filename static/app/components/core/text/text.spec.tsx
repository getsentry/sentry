import {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Heading, Text} from './text';

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
});
