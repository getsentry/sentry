import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

// eslint-disable-next-line no-restricted-imports
import {tct} from 'sentry/locale';

describe('locale.gettextComponentTemplate', () => {
  it('should not wrap translated text in span', () => {
    // spaces are removed because pretter keeps trying to remove them in the snapshot
    expect(
      tct('hello[one]two[three:3]', {
        one: ' one',
        three: <code />,
      })
    ).toMatchInlineSnapshot(`
      <React.Fragment>
        <React.Fragment>
          <React.Fragment>
            hello
          </React.Fragment>
          <React.Fragment>
             one
          </React.Fragment>
          <React.Fragment>
            two
          </React.Fragment>
          <code>
            <React.Fragment>
              3
            </React.Fragment>
          </code>
        </React.Fragment>
      </React.Fragment>
    `);
  });

  it('should render two component templates inside the same parent', () => {
    render(
      <div>
        {tct('1st: [one]', {
          one: 'one',
        })}
        {tct('2nd: [two]', {
          two: 'two',
        })}
      </div>
    );

    expect(
      screen.getByText(textWithMarkupMatcher('1st: one2nd: two'))
    ).toBeInTheDocument();
  });

  it('should render multiple groups with the same name', () => {
    const RenderChildren = ({children}: {children?: React.ReactNode}) => children;
    render(
      <div>
        {tct('[render:one] [render:two] [render:three]', {
          render: <RenderChildren />,
        })}
      </div>
    );

    expect(screen.getByText(textWithMarkupMatcher('one two three'))).toBeInTheDocument();
  });

  it('should render multiple groups with the same name in an HTML tag', () => {
    const {container} = render(
      <div>
        {tct('[render:one] [render:two] [render:three]', {
          render: <b />,
        })}
      </div>
    );

    expect(screen.getByText(textWithMarkupMatcher('one two three'))).toBeInTheDocument();
    expect(container.innerHTML).toBe('<div><b>one</b> <b>two</b> <b>three</b></div>');
  });

  it('should render nested goups', () => {
    const {container} = render(
      <div>
        {tct('[bold:text with [link:another] group]', {
          bold: <b />,
          link: <a href="/link" />,
        })}
      </div>
    );

    expect(
      screen.getByText(textWithMarkupMatcher('text with another group'))
    ).toBeInTheDocument();
    expect(container.innerHTML).toBe(
      '<div><b>text with <a href="/link">another</a> group</b></div>'
    );
  });

  describe('built-in shortcodes', () => {
    it('should render [code] without explicit component', () => {
      render(<div>{tct('Run [code:npm install]')}</div>);
      // [code] uses InlineCode component
      expect(screen.getByText('npm install')).toBeInTheDocument();
      expect(screen.getByText('npm install').tagName).toBe('CODE');
    });

    it('should render [strong] without explicit component', () => {
      render(<div>{tct('This is [strong:important]')}</div>);
      const strongElement = screen.getByText('important');
      expect(strongElement).toBeInTheDocument();
      expect(strongElement.tagName).toBe('STRONG');
    });

    it('should render [bold] normalized to <strong>', () => {
      render(<div>{tct('This is [bold:bold text]')}</div>);
      // [bold] is normalized to <strong> element
      const strongElement = screen.getByText('bold text');
      expect(strongElement).toBeInTheDocument();
      expect(strongElement.tagName).toBe('STRONG');
    });

    it('should render [em] without explicit component', () => {
      render(<div>{tct('This is [em:emphasized]')}</div>);
      const emElement = screen.getByText('emphasized');
      expect(emElement).toBeInTheDocument();
      expect(emElement.tagName).toBe('EM');
    });

    it('should render [italic] normalized to <em>', () => {
      render(<div>{tct('This is [italic:italic text]')}</div>);
      // [italic] is normalized to <em> element
      const emElement = screen.getByText('italic text');
      expect(emElement).toBeInTheDocument();
      expect(emElement.tagName).toBe('EM');
    });

    it('should render [break] for line breaks', () => {
      render(<div>{tct('Line 1[break]Line 2')}</div>);
      // Line breaks don't have semantic queries, verify content appears
      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Line 2/)).toBeInTheDocument();
    });

    it('should allow overriding built-in components', () => {
      render(<div>{tct('[code:custom]', {code: <span className="my-code" />})}</div>);
      const customElement = screen.getByText('custom');
      expect(customElement).toBeInTheDocument();
      expect(customElement).toHaveClass('my-code');
      expect(customElement.tagName).toBe('SPAN');
    });

    it('should handle nested built-in shortcodes', () => {
      render(<div>{tct('[strong:Bold [code:code] text]')}</div>);
      const codeElement = screen.getByText('code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement.tagName).toBe('CODE');
      // Verify it's nested in strong
      expect(codeElement.parentElement?.tagName).toBe('STRONG');
    });

    it('should handle mixed built-in and custom shortcodes', () => {
      render(<div>{tct('[code:value] and [custom:text]', {custom: <em />})}</div>);
      expect(screen.getByText('value')).toBeInTheDocument();
      expect(screen.getByText('value').tagName).toBe('CODE');
      expect(screen.getByText('text')).toBeInTheDocument();
      expect(screen.getByText('text').tagName).toBe('EM');
    });

    it('should handle multiple instances of same built-in shortcode', () => {
      render(<div>{tct('[code:first] and [code:second]')}</div>);
      expect(screen.getByText('first')).toBeInTheDocument();
      expect(screen.getByText('first').tagName).toBe('CODE');
      expect(screen.getByText('second')).toBeInTheDocument();
      expect(screen.getByText('second').tagName).toBe('CODE');
    });

    it('should work with empty template and only built-ins', () => {
      render(<div>{tct('[code:test]')}</div>);
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('test').tagName).toBe('CODE');
    });
  });

  describe('type safety', () => {
    it('should accept built-in shortcodes without components', () => {
      // ✅ Built-in shortcodes work without providing components
      tct('[code:value]');
      tct('[strong:text]');
      tct('[link:here]');
      tct('[em:text]');
      tct('[bold:text]');
      tct('[italic:text]');
      tct('[break]');
    });

    it('should accept built-in shortcodes with optional overrides', () => {
      // ✅ Can optionally override built-ins
      tct('[code:value]', {code: <span />});
      tct('[strong:text]', {strong: <b />});
    });

    it('should require components for custom shortcodes', () => {
      // ✅ Custom shortcodes require components
      tct('[custom:text]', {custom: <div />});

      // @ts-expect-error - custom shortcode without component should fail
      tct('[customShortcode:text]');

      // @ts-expect-error - wrong component key should fail
      tct('[customShortcode:text]', {wrongKey: <div />});
    });

    it('should handle mixed built-in and custom shortcodes', () => {
      // ✅ Built-in + custom: only custom required
      tct('[code:a] [customTag:b]', {customTag: <span />});

      // @ts-expect-error - missing custom component
      tct('[code:a] [customTag:b]');
    });

    it('should extract nested shortcode names', () => {
      // ✅ Nested shortcodes both extracted
      tct('[outerTag:Text [innerTag:value]]', {outerTag: <div />, innerTag: <span />});

      // @ts-expect-error - missing inner component
      tct('[outerTag:Text [innerTag:value]]', {outerTag: <div />});
    });

    it('should allow any components for non-literal strings', () => {
      // ✅ Non-literal strings accept any components (can't be type-checked)
      const getMessage = () => 'some [dynamic:string]';
      // eslint-disable-next-line sentry/no-dynamic-translations
      tct(getMessage(), {anything: <div />});
    });
  });
});
