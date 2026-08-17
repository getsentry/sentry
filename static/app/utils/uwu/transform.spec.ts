import {getSprintfTokens, getTemplateGroups, uwuify} from './transform';

/**
 * Every sprintf shape present in the extracted `build/javascript.po` catalog, so
 * the matrix below covers the real corpus rather than only shapes we imagined.
 */
const SPRINTF_SHAPES = [
  '%s',
  '%d',
  '%f',
  '%%',
  '%(count)s',
  '%(orgSlug)s',
  '%1$s',
  '%2$s',
  '%3$s',
  '%.2f',
  '%05d',
];

const SENTENCE_SHAPES = [
  'Deleted <p> replays from <p>',
  'Showing <p> of <p> events',
  'Learn more about <p>',
  '<p>',
  'all <p> errors resolved',
];

/**
 * The corpus only ever uses `[name:text]` and bare `[name]`, but it nests them,
 * so the nested case is covered here too.
 */
const TEMPLATE_SHAPES = [
  'Learn more about [link:release health]',
  'Seeing this often? [feedbackLink]',
  'Showing [pageEventsCount] of [totalEventsCount] events',
  'Set the [code:environment] tag on [strong:all] releases',
  'Read the [outer:docs and the [inner:release notes]]',
  '[link]',
  ' committed [commitLink] ',
];

describe('uwuify', () => {
  it('replaces l and r with w when given lowercase text', () => {
    const result = uwuify('resolve all errors');

    expect(result).toBe('wesowve aww ewwows');
  });

  it('preserves case when replacing uppercase L and R', () => {
    const result = uwuify('Learn More');

    expect(result).toBe('Weawn Mowe');
  });

  it('inserts y after n when followed by a vowel', () => {
    const result = uwuify('No nice name');

    expect(result).toBe('Nyo nyice nyame');
  });

  it('returns the same output when called repeatedly with the same input', () => {
    const outputs = Array.from({length: 5}, () =>
      uwuify('Alerts allow you to monitor your errors')
    );

    expect(new Set(outputs).size).toBe(1);
  });

  it('leaves every sprintf token untouched when transforming any sentence shape', () => {
    const corrupted = SENTENCE_SHAPES.flatMap(sentence =>
      SPRINTF_SHAPES.map(shape => sentence.replaceAll('<p>', shape))
    ).filter(input => {
      const before = getSprintfTokens(input);
      const after = getSprintfTokens(uwuify(input));
      return before.join(' ') !== after.join(' ');
    });

    expect(corrupted).toEqual([]);
  });

  it('leaves the named argument intact when it contains transformable letters', () => {
    const result = uwuify('Deleted %(count)s replays from %(orgSlug)s');

    expect(result).toBe('Deweted %(count)s wepways fwom %(orgSlug)s');
  });

  it('transforms a label ending in a colon', () => {
    const result = uwuify('Allow list our IP Addresses:');

    expect(result).toBe('Awwow wist ouw IP Addwesses:');
  });

  it('leaves the group name intact when given a bare template group', () => {
    const result = uwuify('Seeing this often? [feedbackLink]');

    expect(result).toBe('Seeing this often? [feedbackLink]');
  });

  it('transforms the group text but not the group name when given both', () => {
    const result = uwuify('Learn more about [link:release health]');

    expect(result).toBe('Weawn mowe about [link:wewease heawth]');
  });

  it('leaves every template group intact when transforming any sentence shape', () => {
    const corrupted = TEMPLATE_SHAPES.filter(input => {
      const before = getTemplateGroups(input);
      const after = getTemplateGroups(uwuify(input));
      return before.join(' ') !== after.join(' ');
    });

    expect(corrupted).toEqual([]);
  });

  it('leaves urls, mentions, and email addresses untouched', () => {
    const result = uwuify(
      'email hello@sentry.io or @claire at https://sentry.io/welcome'
    );

    expect(result).toBe('emaiw hello@sentry.io ow @claire at https://sentry.io/welcome');
  });
});
