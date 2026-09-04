import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {parseRunIdParam, useSeerExplorerDeepLink} from 'sentry/views/seerExplorer/utils';

// URL construction moved to `links.tsx`; its specs (including the metrics query encoding these two
// cases used to cover) live in `links.spec.tsx`.

describe('parseRunIdParam', () => {
  it('parses a legacy numeric run ID into a number', () => {
    expect(parseRunIdParam('123')).toBe(123);
  });

  it('accepts a UUID run ID as a string', () => {
    const uuid = '0fd9e7a2-1c3b-4d5e-8f90-abcdef012345';
    expect(parseRunIdParam(uuid)).toBe(uuid);
  });

  it('rejects values that are neither numeric nor a UUID', () => {
    expect(parseRunIdParam('../../foo')).toBeNull();
    expect(parseRunIdParam('not-a-uuid')).toBeNull();
    expect(parseRunIdParam('')).toBeNull();
    expect(parseRunIdParam('12.5')).toBeNull();
  });
});

describe('useSeerExplorerDeepLink', () => {
  const UUID = '0fd9e7a2-1c3b-4d5e-8f90-abcdef012345';

  function renderDeepLink(explorerRunId: string | undefined, enabled = true) {
    const callback = jest.fn();
    const {router} = renderHookWithProviders(
      () => useSeerExplorerDeepLink({callback, enabled}),
      {
        initialRouterConfig: {
          location: {
            pathname: '/issues/',
            query: explorerRunId === undefined ? {} : {explorerRunId},
          },
        },
      }
    );
    return {callback, router};
  }

  it('opens a UUID run from the deep link and strips the param', async () => {
    const {callback, router} = renderDeepLink(UUID);

    await waitFor(() => expect(callback).toHaveBeenCalledWith(UUID));
    expect(router.location.query.explorerRunId).toBeUndefined();
  });

  it('opens a legacy numeric run as a number', async () => {
    const {callback, router} = renderDeepLink('123');

    await waitFor(() => expect(callback).toHaveBeenCalledWith(123));
    expect(router.location.query.explorerRunId).toBeUndefined();
  });

  it('ignores a malformed param without navigating or invoking the callback', async () => {
    const {callback, router} = renderDeepLink('../../foo');

    // Nothing valid to do, so the param is left in place and untouched.
    await waitFor(() => expect(router.location.query.explorerRunId).toBe('../../foo'));
    expect(callback).not.toHaveBeenCalled();
  });

  it('does nothing when disabled, even with a valid param', async () => {
    const {callback, router} = renderDeepLink(UUID, false);

    await waitFor(() => expect(router.location.query.explorerRunId).toBe(UUID));
    expect(callback).not.toHaveBeenCalled();
  });
});
