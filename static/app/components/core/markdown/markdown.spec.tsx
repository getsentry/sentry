import React from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Markdown} from '@sentry/scraps/markdown';

describe('Markdown', () => {
  describe('basic rendering', () => {
    it('renders paragraphs', () => {
      render(<Markdown raw="Hello world" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders headings', () => {
      render(<Markdown raw="# Heading 1" />);
      expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Heading 1');
    });

    it('renders multiple heading levels', () => {
      render(<Markdown raw={'# H1\n\n## H2\n\n### H3'} />);
      expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('H1');
      expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('H2');
      expect(screen.getByRole('heading', {level: 3})).toHaveTextContent('H3');
    });

    it('renders bold and italic', () => {
      render(<Markdown raw="**bold** *italic*" />);
      expect(screen.getByText('bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
    });

    it('renders inline code', () => {
      render(<Markdown raw="Use `foo()` here" />);
      expect(screen.getByText('foo()')).toBeInTheDocument();
      expect(screen.getByText('foo()').tagName).toBe('CODE');
    });

    it('renders code blocks', () => {
      render(<Markdown raw={'```\nconst x = 1;\n```'} />);
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('renders unordered lists', () => {
      render(<Markdown raw={'- item 1\n- item 2'} />);
      expect(screen.getByText('item 1')).toBeInTheDocument();
      expect(screen.getByText('item 2')).toBeInTheDocument();
      const list = screen.getByRole('list');
      expect(list.tagName).toBe('UL');
    });

    it('renders ordered lists', () => {
      render(<Markdown raw={'1. first\n2. second'} />);
      expect(screen.getByText('first')).toBeInTheDocument();
      const list = screen.getByRole('list');
      expect(list.tagName).toBe('OL');
    });

    it('renders blockquotes', () => {
      render(<Markdown raw="> quoted text" />);
      expect(screen.getByText('quoted text')).toBeInTheDocument();
      expect(screen.getByRole('blockquote')).toBeInTheDocument();
    });

    it('renders horizontal rules', () => {
      render(<Markdown raw={'above\n\n---\n\nbelow'} />);
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('renders tables', () => {
      const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
      render(<Markdown raw={md} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders strikethrough', () => {
      render(<Markdown raw="~~deleted~~" />);
      expect(screen.getByText('deleted')).toBeInTheDocument();
    });

    it('renders line breaks', () => {
      render(<Markdown raw={'line 1  \nline 2'} />);
      expect(screen.getByText(/line 1/)).toBeInTheDocument();
      expect(screen.getByText(/line 2/)).toBeInTheDocument();
    });
  });

  describe('links', () => {
    it('renders safe links', () => {
      render(<Markdown raw="[example](https://example.com)" />);
      const link = screen.getByRole('link', {name: 'example'});
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('renders mailto links', () => {
      render(<Markdown raw="[email](mailto:foo@example.com)" />);
      const link = screen.getByRole('link', {name: 'email'});
      expect(link).toHaveAttribute('href', 'mailto:foo@example.com');
    });

    it('renders link titles', () => {
      render(<Markdown raw='[x](https://example.com "Example Title")' />);
      const link = screen.getByRole('link', {name: 'x'});
      expect(link).toHaveAttribute('title', 'Example Title');
    });

    it('rejects javascript: links', () => {
      render(<Markdown raw="[x](javascript:alert(1))" />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('x')).toBeInTheDocument();
    });

    it('rejects data: links', () => {
      render(<Markdown raw="[x](data:text/html,<script>alert(1)</script>)" />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('rejects vbscript: links', () => {
      render(<Markdown raw="[x](vbscript:foo)" />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('images', () => {
    it('strips images by default', () => {
      render(<Markdown raw="![alt](https://example.com/img.png)" />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders images when Image component is provided', () => {
      render(
        <Markdown
          raw="![alt text](https://example.com/img.png)"
          components={{
            Image: ({src, alt}) => <img src={src} alt={alt} />,
          }}
        />
      );
      expect(screen.getByRole('img')).toHaveAttribute('alt', 'alt text');
    });
  });

  describe('raw HTML', () => {
    it('strips script tags', () => {
      const {container} = render(<Markdown raw="<script>alert(1)</script>hello" />);
      expect(container.innerHTML).not.toContain('<script');
      expect(container.innerHTML).toContain('hello');
    });

    it('strips iframe tags', () => {
      const {container} = render(
        <Markdown raw='<iframe src="https://evil.com"></iframe>' />
      );
      expect(container.innerHTML).not.toContain('<iframe');
    });

    it('strips form elements', () => {
      const {container} = render(
        <Markdown raw='<form action="/evil"><input><button>click</button></form>' />
      );
      expect(container.innerHTML).not.toContain('<form');
      expect(container.innerHTML).not.toContain('<input');
      expect(container.innerHTML).not.toContain('<button');
    });

    it('strips event handler attributes', () => {
      const {container} = render(<Markdown raw='<div onclick="alert(1)">text</div>' />);
      expect(container.innerHTML).not.toContain('onclick');
    });

    it('preserves safe inline HTML like sub and sup', () => {
      render(<Markdown raw="H<sub>2</sub>O and x<sup>2</sup>" />);
      // The full text should render with the sub/sup elements
      expect(screen.getByText(/H.*O and x/)).toBeInTheDocument();
    });
  });

  describe('component overrides', () => {
    it('overrides Paragraph component', () => {
      render(
        <Markdown
          raw="Hello"
          components={{
            Paragraph: ({children}) => <div data-test-id="custom-p">{children}</div>,
          }}
        />
      );
      expect(screen.getByTestId('custom-p')).toHaveTextContent('Hello');
    });

    it('overrides Heading component', () => {
      render(
        <Markdown
          raw="# Title"
          components={{
            Heading: ({children, level}) => (
              <div data-test-id="custom-heading" data-level={level}>
                {children}
              </div>
            ),
          }}
        />
      );
      const heading = screen.getByTestId('custom-heading');
      expect(heading).toHaveTextContent('Title');
      expect(heading).toHaveAttribute('data-level', '1');
    });

    it('overrides Link component', () => {
      render(
        <Markdown
          raw="[click](https://example.com)"
          components={{
            Link: ({href, children}) => (
              <span data-test-id="custom-link" data-href={href}>
                {children}
              </span>
            ),
          }}
        />
      );
      const link = screen.getByTestId('custom-link');
      expect(link).toHaveAttribute('data-href', 'https://example.com');
      expect(link).toHaveTextContent('click');
    });

    it('overrides InlineCode component', () => {
      render(
        <Markdown
          raw="Use `foo()` here"
          components={{
            InlineCode: ({children}) => (
              <span data-test-id="custom-code">{children}</span>
            ),
          }}
        />
      );
      expect(screen.getByTestId('custom-code')).toHaveTextContent('foo()');
    });

    it('overrides CodeBlock component', () => {
      render(
        <Markdown
          raw={'```js\nconst x = 1;\n```'}
          components={{
            CodeBlock: ({children, lang}) => (
              <span data-test-id="custom-code" data-lang={lang}>
                {children}
              </span>
            ),
          }}
        />
      );
      const code = screen.getByTestId('custom-code');
      expect(code).toHaveTextContent('const x = 1;');
      expect(code).toHaveAttribute('data-lang', 'js');
    });

    it('overrides Text component for text transforms', () => {
      render(
        <Markdown
          raw="Issue PROJ-123 is important"
          components={{
            Text: ({children}) => {
              const parts = children.split(/(PROJ-\d+)/);
              return (
                <React.Fragment>
                  {parts.map((part, i) =>
                    /PROJ-\d+/.test(part) ? (
                      <a key={i} href={`/issues/${part}/`}>
                        {part}
                      </a>
                    ) : (
                      part
                    )
                  )}
                </React.Fragment>
              );
            },
          }}
        />
      );
      const link = screen.getByRole('link', {name: 'PROJ-123'});
      expect(link).toHaveAttribute('href', '/issues/PROJ-123/');
    });

    it('Text override does not apply inside code spans', () => {
      let textCallCount = 0;
      render(
        <Markdown
          raw="Normal text and `PROJ-123 in code`"
          components={{
            Text: ({children}) => {
              textCallCount++;
              return <span>{children}</span>;
            },
          }}
        />
      );
      // text component should NOT be called for content inside code spans
      // Code span content goes through the code component, not text
      expect(screen.getByText('PROJ-123 in code').tagName).toBe('CODE');
      expect(textCallCount).toBeGreaterThan(0);
    });
  });

  describe('safety is non-overridable', () => {
    it('custom Link never receives unsafe hrefs', () => {
      const linkFn = jest.fn(({href, children}: any) => (
        <span data-href={href}>{children}</span>
      ));
      render(<Markdown raw="[click](javascript:alert(1))" components={{Link: linkFn}} />);
      expect(linkFn).not.toHaveBeenCalled();
      expect(screen.getByText('click')).toBeInTheDocument();
    });

    it('custom Link receives safe hrefs normally', () => {
      const linkFn = jest.fn(({href, children}: any) => (
        <a data-test-id="safe-link" href={href}>
          {children}
        </a>
      ));
      render(<Markdown raw="[click](https://example.com)" components={{Link: linkFn}} />);
      expect(linkFn).toHaveBeenCalled();
      expect(screen.getByTestId('safe-link')).toHaveAttribute(
        'href',
        'https://example.com'
      );
    });

    it('custom Html receives sanitized content', () => {
      let receivedHtml = '';
      render(
        <Markdown
          raw="<script>alert(1)</script>"
          components={{
            Html: ({html}: {html: string}) => {
              receivedHtml = html;
              return <span data-test-id="custom-html" />;
            },
          }}
        />
      );
      expect(receivedHtml).not.toContain('<script');
    });

    it('images are stripped without an explicit Image component', () => {
      render(<Markdown raw="![alt](https://example.com/img.png)" />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('token caching', () => {
    it('renders correctly when raw prop changes', () => {
      const {rerender} = render(<Markdown raw="First" />);
      expect(screen.getByText('First')).toBeInTheDocument();

      rerender(<Markdown raw="Second" />);
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();
    });

    it('renders correctly when content is appended', () => {
      const {rerender} = render(<Markdown raw="Paragraph one" />);
      expect(screen.getByText('Paragraph one')).toBeInTheDocument();

      rerender(<Markdown raw={'Paragraph one\n\nParagraph two'} />);
      expect(screen.getByText('Paragraph one')).toBeInTheDocument();
      expect(screen.getByText('Paragraph two')).toBeInTheDocument();
    });
  });
});
