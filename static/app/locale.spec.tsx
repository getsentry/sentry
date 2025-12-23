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
      const {container} = render(<div>{tct('Run [code:npm install]')}</div>);
      expect(container.innerHTML).toContain('<code>npm install</code>');
    });

    it('should render [strong] without explicit component', () => {
      const {container} = render(<div>{tct('This is [strong:important]')}</div>);
      expect(container.innerHTML).toContain('<strong>important</strong>');
    });

    it('should render [bold] without explicit component', () => {
      const {container} = render(<div>{tct('This is [bold:bold text]')}</div>);
      expect(container.innerHTML).toContain('<b>bold text</b>');
    });

    it('should render [italic] without explicit component', () => {
      const {container} = render(<div>{tct('This is [italic:italic text]')}</div>);
      expect(container.innerHTML).toContain('<i>italic text</i>');
    });

    it('should render [break] for line breaks', () => {
      const {container} = render(<div>{tct('Line 1[break]Line 2')}</div>);
      expect(container.innerHTML).toContain('<br>');
    });

    it('should allow overriding built-in components', () => {
      const {container} = render(
        <div>{tct('[code:custom]', {code: <span className="my-code" />})}</div>
      );
      expect(container.innerHTML).toContain('<span class="my-code">custom</span>');
      expect(container.innerHTML).not.toContain('<code>');
    });

    it('should handle nested built-in shortcodes', () => {
      const {container} = render(<div>{tct('[strong:Bold [code:code] text]')}</div>);
      expect(container.innerHTML).toContain('<strong>');
      expect(container.innerHTML).toContain('<code>code</code>');
      expect(container.innerHTML).toContain('</strong>');
    });

    it('should handle mixed built-in and custom shortcodes', () => {
      const {container} = render(
        <div>{tct('[code:value] and [custom:text]', {custom: <em />})}</div>
      );
      expect(container.innerHTML).toContain('<code>value</code>');
      expect(container.innerHTML).toContain('<em>text</em>');
    });

    it('should handle multiple instances of same built-in shortcode', () => {
      const {container} = render(<div>{tct('[code:first] and [code:second]')}</div>);
      expect(container.innerHTML).toContain('<code>first</code>');
      expect(container.innerHTML).toContain('<code>second</code>');
    });

    it('should work with empty template and only built-ins', () => {
      const {container} = render(<div>{tct('[code:test]')}</div>);
      expect(container.innerHTML).toContain('<code>test</code>');
    });
  });
});
