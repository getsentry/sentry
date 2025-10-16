import React from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {MarkedText} from 'sentry/utils/marked/markedText';
import {loadPrismLanguage} from 'sentry/utils/prism';

jest.unmock('prismjs');

describe('MarkedText', () => {
  beforeAll(async () => {
    await loadPrismLanguage('javascript', {});
  });

  it('renders markdown as HTML', async () => {
    render(<MarkedText text="**Bold text**" />);

    await waitFor(() => {
      const element = screen.getByText('Bold text');
      expect(element).toBeInTheDocument();
    });

    const element = screen.getByText('Bold text');
    expect(element.tagName).toBe('STRONG');
    expect(element.parentElement?.tagName).toBe('P');
  });

  it('renders with different HTML elements using "as" prop', async () => {
    render(<MarkedText as="span" text="**Bold text**" />);

    await waitFor(() => {
      const element = screen.getByText('Bold text');
      expect(element).toBeInTheDocument();
    });

    const container = document.querySelector('span');
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Bold text').tagName).toBe('STRONG');
  });

  it('renders inline markdown without paragraph tags when inline=true', async () => {
    render(<MarkedText text="**Bold text**" inline />);

    const element = await screen.findByText('Bold text');
    expect(element).toBeInTheDocument();

    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();

    // Inline does not wrap in a paragraph tag
    expect(container?.innerHTML).not.toContain('<p>');
    expect(screen.getByText('Bold text').tagName).toBe('STRONG');
  });

  it('renders links properly and safely', async () => {
    render(<MarkedText text="[Link](https://example.com)" />);

    await waitFor(() => {
      const link = screen.getByText('Link');
      expect(link).toBeInTheDocument();
    });

    const link = screen.getByRole('link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('sanitizes dangerous links', async () => {
    render(<MarkedText text="[Bad Link](javascript:alert('xss'))" />);

    expect(await screen.findByText('Bad Link')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('forwards refs correctly', async () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<MarkedText text="Reference test" ref={ref} />);

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    expect(ref.current?.textContent?.trim()).toBe('Reference test');
  });

  it('passes additional props to the rendered element', async () => {
    render(
      <MarkedText
        text="Custom class"
        className="custom-class"
        data-test-id="custom-element"
      />
    );

    const element = await screen.findByTestId('custom-element');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('custom-class');

    expect(element.textContent?.trim()).toBe('Custom class');
  });

  it('renders syntax highlighting', async () => {
    render(
      <MarkedText
        text={`\`\`\`javascript
console.log("Hello, world!");
\`\`\``}
      />
    );

    // Expect placeholder text to be present
    expect(screen.getByText('console.log("Hello, world!");')).toBeInTheDocument();

    // Wait for syntax highlighting to be applied
    await waitFor(() => {
      const codeElement = document.querySelector('code.language-javascript');
      expect(codeElement).toBeInTheDocument();
    });
  });
});
