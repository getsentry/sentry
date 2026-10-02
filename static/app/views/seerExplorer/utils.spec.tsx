import {useState} from 'react';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {
  parseRunIdParam,
  SeerExplorerDeepLinkParamProvider,
  TOOL_FORMATTERS,
  useSeerExplorerDeepLink,
  useSyncSeerExplorerRunIdToUrl,
} from 'sentry/views/seerExplorer/utils';

// URL construction moved to `links.tsx`; its specs (including the metrics query encoding these two
// cases used to cover) live in `links.spec.tsx`.

describe('TOOL_FORMATTERS.telemetry_live_search', () => {
  const formatter = TOOL_FORMATTERS.telemetry_live_search!;

  it('handles project_slugs as an array', () => {
    const result = formatter(
      {question: 'errors', dataset: 'issues', project_slugs: ['foo', 'bar']},
      false
    );
    expect(result).toBe("Searched for issues in foo, bar: 'errors'");
  });

  it('handles project_slugs as a scalar string without throwing', () => {
    const result = formatter(
      {question: 'errors', dataset: 'issues', project_slugs: 'my-project'},
      false
    );
    expect(result).toBe("Searched for issues in my-project: 'errors'");
  });

  it('handles missing project_slugs', () => {
    const result = formatter({question: 'errors', dataset: 'issues'}, false);
    expect(result).toBe("Searched for issues: 'errors'");
  });

  it('handles project_slugs as an empty array', () => {
    const result = formatter(
      {question: 'errors', dataset: 'spans', project_slugs: []},
      false
    );
    expect(result).toBe("Queried spans: 'errors'");
  });
});

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
  const OTHER_UUID = '1ae8f6b3-2d4c-4e6f-9a01-bcdef0123456';

  function renderDeepLink(explorerRunId: string | undefined, enabled = true) {
    const callback = jest.fn();
    // State lives inside the hook: `rerender` would rebuild the test router.
    const result = renderHookWithProviders(
      () => {
        const [isEnabled, setEnabled] = useState(enabled);
        useSeerExplorerDeepLink({callback, enabled: isEnabled});
        return setEnabled;
      },
      {
        initialRouterConfig: {
          location: {
            pathname: '/issues/',
            query: explorerRunId === undefined ? {} : {explorerRunId},
          },
        },
      }
    );
    return {callback, ...result};
  }

  it('opens a UUID run from the deep link and keeps the param', async () => {
    const {callback, router} = renderDeepLink(UUID);

    await waitFor(() => expect(callback).toHaveBeenCalledWith(UUID));
    expect(router.location.query.explorerRunId).toBe(UUID);
  });

  it('opens a legacy numeric run as a number', async () => {
    const {callback, router} = renderDeepLink('123');

    await waitFor(() => expect(callback).toHaveBeenCalledWith(123));
    expect(router.location.query.explorerRunId).toBe('123');
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

  it('only fires once per param value', async () => {
    const {callback, router} = renderDeepLink(UUID);
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

    // Unrelated navigation keeps the same run ID, so it must not re-open the run.
    act(() => router.navigate(`/issues/?explorerRunId=${UUID}&query=foo`));
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => router.navigate(`/issues/?explorerRunId=${OTHER_UUID}`));
    await waitFor(() => expect(callback).toHaveBeenLastCalledWith(OTHER_UUID));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not fire for a value already seen while disabled', () => {
    const {callback, result} = renderDeepLink(UUID, false);

    // e.g. closing the drawer re-enables the provider's listener; the run was already handled.
    act(() => result.current(true));
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not fire for a listener that mounts after the param was handled', async () => {
    const providerCallback = jest.fn();
    const contentCallback = jest.fn();

    function Listener({callback}: {callback: (runId: SeerExplorerRunId) => void}) {
      useSeerExplorerDeepLink({callback});
      return null;
    }

    function Harness() {
      const [showContent, setShowContent] = useState(false);
      return (
        <SeerExplorerDeepLinkParamProvider>
          <Listener callback={providerCallback} />
          {showContent && <Listener callback={contentCallback} />}
          <button onClick={() => setShowContent(true)}>Mount content</button>
        </SeerExplorerDeepLinkParamProvider>
      );
    }

    render(<Harness />, {
      initialRouterConfig: {
        location: {pathname: '/issues/', query: {explorerRunId: UUID}},
      },
    });
    await waitFor(() => expect(providerCallback).toHaveBeenCalledWith(UUID));

    // e.g. the chat content remounting for a new chat while the old param is still in the URL.
    await userEvent.click(screen.getByRole('button', {name: 'Mount content'}));
    expect(contentCallback).not.toHaveBeenCalled();
  });
});

describe('useSyncSeerExplorerRunIdToUrl', () => {
  const UUID = '0fd9e7a2-1c3b-4d5e-8f90-abcdef012345';
  const OTHER_UUID = '1ae8f6b3-2d4c-4e6f-9a01-bcdef0123456';

  function renderSync(runId: SeerExplorerRunId | null, query: Record<string, string>) {
    const {result, router} = renderHookWithProviders(
      () => {
        const [currentRunId, setRunId] = useState(runId);
        useSyncSeerExplorerRunIdToUrl(currentRunId);
        return setRunId;
      },
      {initialRouterConfig: {location: {pathname: '/issues/', query}}}
    );
    const switchRun = (newRunId: SeerExplorerRunId | null) =>
      act(() => result.current(newRunId));
    return {router, switchRun};
  }

  it('does not touch the URL on mount', () => {
    const {router} = renderSync(OTHER_UUID, {explorerRunId: UUID});

    expect(router.location.query.explorerRunId).toBe(UUID);
  });

  it('updates the param when the run changes and the param is present', async () => {
    const {router, switchRun} = renderSync(UUID, {explorerRunId: UUID, query: 'foo'});

    switchRun(OTHER_UUID);
    await waitFor(() => expect(router.location.query.explorerRunId).toBe(OTHER_UUID));
    expect(router.location.query.query).toBe('foo');
  });

  it('removes the param when switching to a new chat', async () => {
    const {router, switchRun} = renderSync(UUID, {explorerRunId: UUID});

    switchRun(null);
    await waitFor(() => expect(router.location.query.explorerRunId).toBeUndefined());
  });

  it('returns to the previous conversation on browser back', async () => {
    // Both hooks together, as the provider and chat content wire them: the deep link
    // listener switches runs when the param changes, and the sync writes the param.
    const {result, router} = renderHookWithProviders(
      () => {
        const [runId, setRunId] = useState<SeerExplorerRunId | null>(UUID);
        useSeerExplorerDeepLink({callback: setRunId});
        useSyncSeerExplorerRunIdToUrl(runId);
        return {runId, setRunId};
      },
      {
        initialRouterConfig: {
          location: {pathname: '/issues/', query: {explorerRunId: UUID}},
        },
      }
    );

    act(() => result.current.setRunId(OTHER_UUID));
    await waitFor(() => expect(router.location.query.explorerRunId).toBe(OTHER_UUID));

    act(() => router.navigate(-1));
    await waitFor(() => expect(router.location.query.explorerRunId).toBe(UUID));
    expect(result.current.runId).toBe(UUID);
  });

  it('does not add the param when it was not in the URL', () => {
    const {router, switchRun} = renderSync(UUID, {query: 'foo'});

    switchRun(OTHER_UUID);
    expect(router.location.query.explorerRunId).toBeUndefined();
    expect(router.location.query.query).toBe('foo');
  });
});
