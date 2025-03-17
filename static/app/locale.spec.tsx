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
});
