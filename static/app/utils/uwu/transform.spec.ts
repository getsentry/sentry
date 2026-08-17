import {EXCLAMATIONS, FACES} from './embellish';
import {
  getSprintfTokens,
  getTemplateGroups,
  uwuify,
  uwuifyLeaves,
  uwuifyPhonemes,
} from './transform';

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

const SPRINTF_INPUTS = SENTENCE_SHAPES.flatMap(sentence =>
  SPRINTF_SHAPES.map(shape => sentence.replaceAll('<p>', shape))
);

/**
 * Counts exactly rather than by pattern-matching for stutters: a hyphenated word
 * whose halves both start with `w` ("error-waves" -> "ewwow-waves") looks exactly
 * like a stutter to a regex, so the only reliable check is whether removing one
 * inserted prefix reproduces the un-embellished string.
 */
function countEmbellishments(source: string): number {
  const phonetic = uwuifyPhonemes(source);
  const output = uwuify(source);

  if (output === phonetic) {
    return 0;
  }

  if (FACES.some(face => output === `${phonetic} ${face}`)) {
    return 1;
  }

  const trailing = /[?!]+$/.exec(phonetic);
  if (trailing) {
    const stem = phonetic.slice(0, -trailing[0].length);
    if (EXCLAMATIONS.some(exclamation => output === stem + exclamation)) {
      return 1;
    }
  }

  for (let index = 0; index < output.length - 1; index++) {
    if (output[index + 1] !== '-') {
      continue;
    }
    if (output.slice(0, index) + output.slice(index + 2) === phonetic) {
      return 1;
    }
  }

  return 2;
}

describe('uwuifyPhonemes', () => {
  it('replaces l and r with w when given lowercase text', () => {
    const result = uwuifyPhonemes('resolve all errors');

    expect(result).toBe('wesowve aww ewwows');
  });

  it('preserves case when replacing uppercase L and R', () => {
    const result = uwuifyPhonemes('Learn More');

    expect(result).toBe('Weawn Mowe');
  });

  it('inserts y after n when followed by a vowel', () => {
    const result = uwuifyPhonemes('No nice name');

    expect(result).toBe('Nyo nyice nyame');
  });

  it('substitutes the lexicon form instead of the phoneme rules', () => {
    const result = uwuifyPhonemes('A small friend please');

    expect(result).toBe('A smol fwiend pwease');
  });

  it('capitalises the lexicon form when the source word is capitalised', () => {
    const result = uwuifyPhonemes('The small print');

    expect(result).toBe('Da smol pwint');
  });

  it('leaves the named argument intact when it contains transformable letters', () => {
    const result = uwuifyPhonemes('Deleted %(count)s replays from %(orgSlug)s');

    expect(result).toBe('Deweted %(count)s wepways fwom %(orgSlug)s');
  });

  it('transforms a label ending in a colon', () => {
    const result = uwuifyPhonemes('Allow list our IP Addresses:');

    expect(result).toBe('Awwow wist ouw IP Addwesses:');
  });

  it('leaves the group name intact when given a bare template group', () => {
    const result = uwuifyPhonemes('Seeing this often? [feedbackLink]');

    expect(result).toBe('Seeing this often? [feedbackLink]');
  });

  it('transforms the group text but not the group name when given both', () => {
    const result = uwuifyPhonemes('Learn more about [link:release health]');

    expect(result).toBe('Weawn mowe about [link:wewease heawth]');
  });

  it('leaves urls, mentions, and email addresses untouched', () => {
    const result = uwuifyPhonemes(
      'email hello@sentry.io or @claire at https://sentry.io/welcome'
    );

    expect(result).toBe('emaiw hello@sentry.io ow @claire at https://sentry.io/welcome');
  });
});

describe('uwuify', () => {
  it('returns the same output when called repeatedly and interleaved', () => {
    const outputs = Array.from({length: 100}, (_, index) => {
      uwuify(`unrelated noise ${index}`);
      return uwuify('Alerts allow you to monitor your errors');
    });

    expect(new Set(outputs).size).toBe(1);
  });

  it('returns the same output for two strings sharing a seed', () => {
    const outputs = [
      uwuify('%s error', '%s error'),
      uwuify('%s error', '%s errors'),
      uwuify('%s error', '%s error'),
    ];

    expect(outputs[0]).toBe(outputs[2]);
  });

  it('leaves every sprintf token untouched when transforming any sentence shape', () => {
    const corrupted = SPRINTF_INPUTS.filter(
      input =>
        getSprintfTokens(input).join(' ') !== getSprintfTokens(uwuify(input)).join(' ')
    );

    expect(corrupted).toEqual([]);
  });

  it('leaves every template group intact when transforming any template shape', () => {
    const corrupted = TEMPLATE_SHAPES.filter(
      input =>
        getTemplateGroups(input).join(' ') !== getTemplateGroups(uwuify(input)).join(' ')
    );

    expect(corrupted).toEqual([]);
  });

  it('spends at most one embellishment on any sentence shape', () => {
    const overspent = [...SPRINTF_INPUTS, ...TEMPLATE_SHAPES].filter(
      input => countEmbellishments(input) > 1
    );

    expect(overspent).toEqual([]);
  });

  it('places the face at the end when it spends the budget on one', () => {
    const result = uwuify('Resolve all errors');

    expect(result).toBe('Wesowve aww ewwows >w<');
  });

  it('replaces the trailing punctuation run when the phrase ends in one', () => {
    const result = uwuify('Are you sure you want to delete this alert?');

    expect(result).toBe('Awe yew suwe yew want to dewete this awewt!!11');
  });

  it('leaves a phrase with no letters alone', () => {
    const results = ['300', '%s', '1.0.0', '-'].map(source => uwuify(source));

    expect(results).toEqual(['300', '%s', '1.0.0', '-']);
  });

  it('does not stutter a word that starts with a digit', () => {
    const sources = [
      'Defaults to 1',
      '5 minutes ago',
      'We recommend adding a backup 2FA method',
      'Response Codes (3XX, 4XX, 5XX)',
    ];

    const stuttered = sources
      .map(source => uwuify(source))
      .filter(result => /(?:^| |\()(\d)-\1/.test(result));

    expect(stuttered).toEqual([]);
  });

  it('embellishes a phrase whose only letters sit outside the placeholder', () => {
    const result = uwuify('%smin');

    expect(result.startsWith('%smin')).toBe(true);
  });

  it('never stutters an email address', () => {
    const result = uwuify(
      'email hello@sentry.io or @claire at https://sentry.io/welcome'
    );

    expect(result).toContain('hello@sentry.io');
  });
});

describe('uwuifyLeaves', () => {
  it('leaves an empty trailing leaf empty when spending the budget', () => {
    const result = uwuifyLeaves(['Learn more about ', 'release health', ''], 'seed');

    expect(result[2]).toBe('');
  });

  it('returns the same leaves when called repeatedly with the same seed', () => {
    const first = uwuifyLeaves(['Read the ', 'docs'], 'Read the [link:docs]');
    const second = uwuifyLeaves(['Read the ', 'docs'], 'Read the [link:docs]');

    expect(first).toEqual(second);
  });
});

describe('uwuify with expansion', () => {
  const PHRASES = [
    'Resolve all errors in this project',
    'Alerts allow you to monitor your errors',
    'Showing %s of %s events in the selected period',
    'Learn more about [link:release health] in our documentation',
    'Are you sure you want to delete this alert rule?',
  ];

  it('reaches the requested inflation across a set of phrases', () => {
    const source = PHRASES.join('').length;
    const expanded = PHRASES.map(phrase => uwuify(phrase, phrase, 0.35)).join('').length;

    expect(expanded / source).toBeGreaterThanOrEqual(1.3);
  });

  it('inflates further when asked for more', () => {
    const lengths = [0.1, 0.35, 0.8].map(
      ratio => PHRASES.map(phrase => uwuify(phrase, phrase, ratio)).join('').length
    );

    expect(lengths[0]! < lengths[1]! && lengths[1]! < lengths[2]!).toBe(true);
  });

  it('leaves every sprintf token untouched when expanding', () => {
    const corrupted = SPRINTF_INPUTS.filter(
      input =>
        getSprintfTokens(input).join(' ') !==
        getSprintfTokens(uwuify(input, input, 0.8)).join(' ')
    );

    expect(corrupted).toEqual([]);
  });

  it('leaves every template group intact when expanding', () => {
    const corrupted = TEMPLATE_SHAPES.filter(
      input =>
        getTemplateGroups(input).join(' ') !==
        getTemplateGroups(uwuify(input, input, 0.8)).join(' ')
    );

    expect(corrupted).toEqual([]);
  });

  it('stutters a word more than once when one pass cannot reach the target', () => {
    const result = uwuify('Alerts allow you to monitor your errors', undefined, 1.2);

    expect(/(\w)-\1-/.test(result)).toBe(true);
  });

  it('returns the same output when expanding repeatedly with the same seed', () => {
    const outputs = Array.from({length: 20}, () =>
      uwuify('Alerts allow you to monitor your errors', undefined, 0.35)
    );

    expect(new Set(outputs).size).toBe(1);
  });
});
