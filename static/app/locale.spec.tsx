import {act, render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {getDuration} from '@sentry/scraps/duration';
import {getRelativeDate, useRelativeTimeFormatter} from '@sentry/scraps/relativeTime';

import {formatChartDateTime} from './components/charts/formatChartDateTime';
import {DEFAULT_LOCALE_DATA, getLocaleSnapshot, setLocale, t, tct, tn} from './locale';

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

describe('locale snapshot contextual translations', () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE_DATA);
  });

  it('should translate a msgid separately for each context', () => {
    setLocale({
      ...DEFAULT_LOCALE_DATA,
      m: ['млн'],
      'abbreviated minutes\u0004m': ['м'],
    });

    const result = [
      t('m'),
      getLocaleSnapshot().messages.pgettext('abbreviated minutes', 'm'),
    ];

    expect(result).toEqual(['млн', 'м']);
  });

  it('should fall back to the msgid when the context has no translation', () => {
    setLocale({...DEFAULT_LOCALE_DATA, m: ['млн']});

    const result = getLocaleSnapshot().messages.pgettext('abbreviated minutes', 'm');

    expect(result).toBe('m');
  });
});

describe('shared formatter translations', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:02Z'));
  });
  afterEach(() => {
    try {
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
      act(() => setLocale(DEFAULT_LOCALE_DATA));
    }
  });

  it('keeps plural count formatting and catalog bindings consistent', () => {
    const original = getLocaleSnapshot();
    expect(original.messages.tn('%s item', '%s items', 2)).toBe(
      tn('%s item', '%s items', 2)
    );
    setLocale({
      ...DEFAULT_LOCALE_DATA,
      '%s item': ['%s article', '%s articles'],
    });
    const translated = getLocaleSnapshot();
    expect(translated.messages.tn('%s item', '%s items', 9999)).toBe(
      tn('%s item', '%s items', 9999)
    );
    expect(original.messages.tn('%s item', '%s items', 2)).toBe('2 items');
    expect(translated.messages.tn('%s item', '%s items', 2)).toBe('2 articles');
  });

  it('uses the active locale for duration and relative-date formatting', () => {
    expect(getDuration(2)).toBe('2 seconds');
    setLocale({...DEFAULT_LOCALE_DATA, second: ['seconde', 'secondes']});
    expect(getDuration(2)).toBe('2 secondes');
    expect(getRelativeDate('2026-01-01T00:00:00Z', {rounding: 'unit', suffix: ''})).toBe(
      '2 secondes'
    );
    setLocale(DEFAULT_LOCALE_DATA);
    expect(getDuration(2)).toBe('2 seconds');
  });

  it('updates a mounted relative time with a complete phrase from the new catalog', () => {
    const date = '2026-01-01T00:00:00Z';
    function RelativeDate() {
      const format = useRelativeTimeFormatter();
      return <span>{format(date, {rounding: 'unit'})}</span>;
    }
    render(<RelativeDate />);
    expect(screen.getByText('2 seconds ago')).toBeInTheDocument();

    act(() => {
      setLocale({
        ...DEFAULT_LOCALE_DATA,
        '': {...DEFAULT_LOCALE_DATA[''], lang: 'fr'},
        second: ['seconde', 'secondes'],
        '%s ago': ['il y a %s'],
        'in %s': ['dans %s'],
      });
    });
    expect(screen.getByText('il y a 2 secondes')).toBeInTheDocument();
    expect(getRelativeDate(date, {rounding: 'unit'})).toBe('il y a 2 secondes');
    expect(
      formatChartDateTime('2026-01-01T00:00:00Z', 'ordinalDate', {timezone: 'UTC'})
    ).toBe('1 janv.');
    expect(getRelativeDate('2026-01-01T00:00:04Z', {rounding: 'unit'})).toBe(
      'dans 2 secondes'
    );
  });
});
