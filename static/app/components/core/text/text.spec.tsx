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
});
