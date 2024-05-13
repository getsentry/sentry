import {renderHook} from 'sentry-test/reactTestingLibrary';

import useTruncatedReleaseNames from 'sentry/views/performance/mobile/useTruncatedRelease';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {ELLIPSIS} from 'sentry/views/starfish/utils/centerTruncate';

jest.mock('sentry/views/starfish/queries/useReleases');

jest.mocked(useReleaseSelection).mockReturnValue({
  primaryRelease: 'com.example.vu.android@2.10.5-alpha.1+42',
  isLoading: false,
  secondaryRelease: 'com.example.vu.android@2.10.3+42',
});

describe('useTruncatedRelease', () => {
  it('truncates long release names to 12 characters by default', () => {
    const {result} = renderHook(useTruncatedReleaseNames);

    expect(
      [...result.current.truncatedPrimaryRelease].filter(char => char !== ELLIPSIS)
    ).toHaveLength(12);

    expect(result.current.truncatedPrimaryRelease).toBe('2.10.5…1 (42)');
    expect(result.current.truncatedSecondaryRelease).toBe('2.10.3 (42)');
  });

  it('truncates long release names to provided length limit', () => {
    const {result} = renderHook(useTruncatedReleaseNames, {
      initialProps: 5,
    });

    expect(
      [...result.current.truncatedPrimaryRelease].filter(char => char !== ELLIPSIS).length
    ).toBeLessThanOrEqual(5);

    expect(result.current.truncatedPrimaryRelease).toBe('2.…2)');
    expect(result.current.truncatedSecondaryRelease).toBe('2.…2)');
  });
});
