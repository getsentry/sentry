import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TextWidgetVisualization} from './textWidgetVisualization';

describe('TextWidgetVisualization', () => {
  it('renders empty state with em dash when no description provided', () => {
    render(<TextWidgetVisualization />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders empty state with em dash when description is empty string', () => {
    render(<TextWidgetVisualization text="" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders plain text without markdown', () => {
    render(<TextWidgetVisualization text="This is plain text" />);
    expect(screen.getByText('This is plain text')).toBeInTheDocument();
  });

  it('renders markdown bold text', () => {
    render(<TextWidgetVisualization text="This is **bold text**" />);
    const container = screen.getByText((content, element) => {
      return element?.tagName === 'STRONG' && content === 'bold text';
    });
    expect(container).toBeInTheDocument();
  });

  it('renders markdown italic text', () => {
    render(<TextWidgetVisualization text="This is *italic text*" />);
    const container = screen.getByText((content, element) => {
      return element?.tagName === 'EM' && content === 'italic text';
    });
    expect(container).toBeInTheDocument();
  });

  it('renders markdown links', () => {
    render(<TextWidgetVisualization text="[Click here](https://example.com)" />);
    const link = screen.getByRole('link', {name: 'Click here'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders markdown headings', () => {
    render(<TextWidgetVisualization text="# Heading 1" />);
    expect(
      screen.getByRole('heading', {level: 1, name: 'Heading 1'})
    ).toBeInTheDocument();
  });

  it('renders markdown code blocks', async () => {
    const code = '```javascript\nconst foo = "bar";\n```';
    render(<TextWidgetVisualization text={code} />);
    expect(await screen.findByText(/const foo/)).toBeInTheDocument();
  });

  it('renders markdown lists', () => {
    const list = '- Item 1\n- Item 2\n- Item 3';
    render(<TextWidgetVisualization text={list} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders multiline text with line breaks', () => {
    const multiline = 'Line 1\n\nLine 2\n\nLine 3';
    render(<TextWidgetVisualization text={multiline} />);
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Line 3')).toBeInTheDocument();
  });

  it('renders complex markdown with mixed formatting', () => {
    const markdown =
      '# Title\n\nThis is **bold** and *italic* text with a [link](https://example.com)';
    render(<TextWidgetVisualization text={markdown} />);
    expect(screen.getByRole('heading', {level: 1, name: 'Title'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'link'})).toBeInTheDocument();
  });

  it('sanitizes dangerous markdown and does not execute scripts', () => {
    const dangerousMarkdown = '[XSS](javascript:alert("XSS"))';
    render(<TextWidgetVisualization text={dangerousMarkdown} />);
    // Should render as plain text, not as a clickable link with javascript: protocol
    const links = screen.queryAllByRole('link');
    links.forEach(link => {
      // eslint-disable-next-line no-script-url
      expect(link.getAttribute('href')).not.toContain('javascript:');
    });
  });
});
