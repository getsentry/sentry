import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

// eslint-disable-next-line no-restricted-imports
import {t, tct, tn} from 'sentry/locale';
import {setUwuEnabled} from 'sentry/utils/uwu';

describe('locale with the uwu transform enabled', () => {
  beforeEach(() => {
    setUwuEnabled(true);
  });

  afterEach(() => {
    setUwuEnabled(false);
  });

  it('transforms the string when calling t', () => {
    const result = t('Resolve all errors');

    expect(result).toBe('Wesowve aww ewwows');
  });

  it('leaves the named argument intact when calling t with one', () => {
    const result = t('Deleted %(count)s replays', {count: 4});

    expect(result).toBe('Deweted 4 wepways');
  });

  it('transforms both forms when calling tn', () => {
    const results = [tn('%s error', '%s errors', 1), tn('%s error', '%s errors', 4)];

    expect(results).toEqual(['1 ewwow', '4 ewwows']);
  });

  it('transforms the text but not the group name when calling tct', () => {
    render(
      <div>
        {tct('Learn more about [link:release health]', {
          link: <a href="/docs/">anchor</a>,
        })}
      </div>
    );

    expect(
      screen.getByText(textWithMarkupMatcher('Weawn mowe about wewease heawth'))
    ).toBeInTheDocument();
  });

  it('still resolves every group when the names would otherwise be transformed', () => {
    render(
      <div>
        {tct('Read the [link:docs] and the [strong:release notes]', {
          link: <a href="/docs/">docs</a>,
          strong: <strong />,
        })}
      </div>
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/docs/');
  });

  it('returns untransformed text when the transform is disabled', () => {
    setUwuEnabled(false);

    const result = t('Resolve all errors');

    expect(result).toBe('Resolve all errors');
  });
});
