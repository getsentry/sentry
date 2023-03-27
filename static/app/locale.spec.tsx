import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

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
});
