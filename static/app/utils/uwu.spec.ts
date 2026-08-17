import {uwuify} from 'sentry/utils/uwu';

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

  it('returns text unchanged when it contains no transformable characters', () => {
    const result = uwuify('%s of %s');

    expect(result).toBe('%s of %s');
  });
});
