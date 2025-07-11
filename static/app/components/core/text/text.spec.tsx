import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
