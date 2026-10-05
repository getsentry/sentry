import {hasScrubbedData} from 'sentry/components/events/meta/annotatedText/utils';

describe('hasScrubbedData', () => {
  it('returns true when a remark comes from a data scrubbing rule', () => {
    const isScrubbed = hasScrubbedData([['organization:0', 's', 0, 10]]);

    expect(isScrubbed).toBe(true);
  });

  it('returns false when the only remark is a size limit', () => {
    const isScrubbed = hasScrubbedData([['!limit', 'x', 0, 100]]);

    expect(isScrubbed).toBe(false);
  });

  it('returns false when the only remarks are non-scrubbing rules', () => {
    const isScrubbed = hasScrubbedData([
      ['!limit', 'x'],
      ['!raw', 'x'],
      ['!config', 'x'],
    ]);

    expect(isScrubbed).toBe(false);
  });

  it('returns true when a scrubbing rule accompanies a size limit', () => {
    const isScrubbed = hasScrubbedData([
      ['!limit', 'x'],
      ['project:1', 'm'],
    ]);

    expect(isScrubbed).toBe(true);
  });

  it('returns false when there are no remarks', () => {
    const isScrubbed = [hasScrubbedData([]), hasScrubbedData(undefined)];

    expect(isScrubbed).toEqual([false, false]);
  });
});
