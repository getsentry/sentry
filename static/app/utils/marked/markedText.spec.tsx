import React from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {MarkedText} from 'sentry/utils/marked/markedText';

describe('MarkedText', function () {
  it('renders markdown as HTML', async function () {
    render(<MarkedText text="**Bold text**" />);

    await waitFor(() => {
      const element = screen.getByText('Bold text');
      expect(element).toBeInTheDocument();
    });

    const element = screen.getByText('Bold text');
    expect(element.tagName).toBe('STRONG');
    expect(element.parentElement?.tagName).toBe('P');
  });

  it('renders with different HTML elements using "as" prop', async function () {
    render(<MarkedText as="span" text="**Bold text**" />);

    const element = await screen.findByText('Bold text');
    expect(element).toBeInTheDocument();

    const container = document.querySelector('span');
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Bold text').tagName).toBe('STRONG');
  });

  it('renders inline markdown without paragraph tags when inline=true', async function () {
    render(<MarkedText text="**Bold text**" inline />);

    const element = await screen.findByText('Bold text');
    expect(element).toBeInTheDocument();

    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
    expect(container?.innerHTML).not.toContain('<p>');
    expect(screen.getByText('Bold text').tagName).toBe('STRONG');
  });

  it('renders links properly and safely', async function () {
    render(<MarkedText text="[Link](https://example.com)" />);

    const link = await screen.findByText('Link');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('sanitizes dangerous links', async function () {
    render(<MarkedText text="[Bad Link](javascript:alert('xss'))" />);

    expect(await screen.findByText('Bad Link')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('forwards refs correctly', async function () {
    const ref = React.createRef<HTMLDivElement>();
    render(<MarkedText text="Reference test" ref={ref} />);

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    expect(ref.current?.textContent?.trim()).toBe('Reference test');
  });

  it('passes additional props to the rendered element', async function () {
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
});
