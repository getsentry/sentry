import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import * as analytics from 'sentry/utils/analytics';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import * as useDimensionsModule from 'sentry/utils/useDimensions';
import type {OpenSeerExplorerDrawerOptions} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {SeerExplorerSidebarLayout} from 'sentry/views/seerExplorer/components/sidebar/seerExplorerSidebarLayout';
import * as useSeerExplorerModule from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import {
  SeerExplorerContextProvider,
  useSeerExplorerContext,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const POSITION_KEY = 'seer-explorer-sidebar-position';

const seerFeatures = ['seer-explorer', 'gen-ai-features'];

const defaultHookReturn: ReturnType<typeof useSeerExplorerModule.useSeerExplorer> = {
  sessionData: null,
  isPolling: false,
  isError: false,
  errorStatusCode: undefined,
  isTimedOut: false,
  runId: null,
  overrideBashModeEnabled: false,
  overrideCtxEngEnable: true,
  overrideCodeModeEnable: 'off',
  hasSentInterrupt: false,
  sendMessage: jest.fn(),
  switchToRun: jest.fn(),
  startNewSession: jest.fn(),
  interruptRun: jest.fn(),
  respondToUserInput: jest.fn(),
  createPR: jest.fn(),
  setOverrideBashModeEnabled: jest.fn(),
  setOverrideCtxEngEnable: jest.fn(),
  setOverrideCodeModeEnable: jest.fn(),
};

// Non-zero size so the SplitPanel isn't gated out (jsdom reports 0×0).
const CONTAINER_SIZE = {width: 1200, height: 800};

// Drive matchMedia per-query so the wide-screen and short-landscape checks can
// resolve independently.
function mockMatchMedia(matches: (query: string) => boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// Orientation is driven by media queries (the `xl` width breakpoint and a
// short-landscape check); match every query uniformly.
function mockWideScreen(matches: boolean) {
  mockMatchMedia(() => matches);
}

function OpenSeerControl({options}: {options?: OpenSeerExplorerDrawerOptions}) {
  const {openSeerExplorer, toggleSeerExplorer} = useSeerExplorerContext();
  return (
    <Fragment>
      <button type="button" onClick={() => openSeerExplorer(options)}>
        open-seer
      </button>
      <button type="button" onClick={() => toggleSeerExplorer()}>
        toggle-seer
      </button>
    </Fragment>
  );
}

function sidebarTree(openOptions?: OpenSeerExplorerDrawerOptions) {
  return (
    <SeerExplorerSessionsProvider>
      <SeerExplorerChatStateProvider>
        <PictureInPictureProvider>
          <GlobalDrawer>
            <SeerExplorerContextProvider>
              <SeerExplorerSidebarLayout>
                <div>main app content</div>
              </SeerExplorerSidebarLayout>
              <OpenSeerControl options={openOptions} />
            </SeerExplorerContextProvider>
          </GlobalDrawer>
        </PictureInPictureProvider>
      </SeerExplorerChatStateProvider>
    </SeerExplorerSessionsProvider>
  );
}

function renderSidebar(
  organization: ReturnType<typeof OrganizationFixture>,
  openOptions?: OpenSeerExplorerDrawerOptions
) {
  return render(sidebarTree(openOptions), {organization});
}

// The split divider is a `role="separator"`; its `data-orientation` is the
// layout orientation (`horizontal` = right dock, `vertical` = bottom dock).
// Absent when there's no split (Seer closed / not yet measured).
function splitOrientation() {
  return screen.queryByRole('separator')?.getAttribute('data-orientation') ?? undefined;
}

describe('SeerExplorerSidebarLayout', () => {
  const orgWithSidebar = OrganizationFixture({
    openMembership: true,
    hideAiFeatures: false,
    features: [...seerFeatures, 'seer-explorer-persistent-sidebar'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();
    // jsdom reports 0×0, which would gate out the SplitPanel — provide a real size.
    jest.spyOn(useDimensionsModule, 'useDimensions').mockReturnValue(CONTAINER_SIZE);
    // Narrow viewport by default → auto docks to the bottom.
    mockWideScreen(false);
    jest
      .spyOn(useSeerExplorerModule, 'useSeerExplorer')
      .mockReturnValue(defaultHookReturn);
    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithSidebar.slug}/seer/runs/`,
      method: 'GET',
      body: [],
    });
    // Slack integration lookup that drives the reinstall nudge.
    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithSidebar.slug}/integrations/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders content untouched (no split panel) when the flag is off', async () => {
    const orgNoFlag = OrganizationFixture({
      openMembership: true,
      hideAiFeatures: false,
      features: seerFeatures,
    });

    renderSidebar(orgNoFlag);

    expect(await screen.findByText('main app content')).toBeInTheDocument();
    expect(splitOrientation()).toBeUndefined();
    expect(screen.queryByTestId('seer-explorer-input')).not.toBeInTheDocument();
  });

  it('keeps content full-width until Seer is opened', async () => {
    renderSidebar(orgWithSidebar);

    expect(await screen.findByText('main app content')).toBeInTheDocument();
    // Closed → no split divider, no Seer content.
    expect(splitOrientation()).toBeUndefined();
    expect(screen.queryByTestId('seer-explorer-input')).not.toBeInTheDocument();
  });

  it('renders the app content before the container is measured', async () => {
    // jsdom reports 0×0 until measured; the routed app must still be in the tree.
    jest
      .spyOn(useDimensionsModule, 'useDimensions')
      .mockReturnValue({width: 0, height: 0});

    renderSidebar(orgWithSidebar);

    expect(await screen.findByText('main app content')).toBeInTheDocument();
    // No split until measured.
    expect(splitOrientation()).toBeUndefined();
  });

  it('does not remount the app when the container is measured', async () => {
    // Start unmeasured, then report a real size — the routed app DOM node must
    // be preserved (the SplitPanel is always rendered, never swapped in).
    const dims = jest
      .spyOn(useDimensionsModule, 'useDimensions')
      .mockReturnValue({width: 0, height: 0});

    const {rerender} = render(sidebarTree(), {organization: orgWithSidebar});
    const before = await screen.findByText('main app content');

    dims.mockReturnValue(CONTAINER_SIZE);
    rerender(sidebarTree());

    expect(screen.getByText('main app content')).toBe(before);
  });

  it('docks Seer to the bottom on a narrow viewport (auto)', async () => {
    mockWideScreen(false);
    renderSidebar(orgWithSidebar);

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(splitOrientation()).toBe('vertical');
  });

  it('docks Seer to the right on a wide viewport (auto)', async () => {
    mockWideScreen(true);
    renderSidebar(orgWithSidebar);

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(splitOrientation()).toBe('horizontal');
  });

  it('docks Seer to the right on a short landscape viewport (auto)', async () => {
    // Not wide (min-width: xl is false), but landscape and short — e.g. a phone
    // held sideways, where a bottom dock has no room. Auto docks right instead.
    mockMatchMedia(query => query.includes('orientation: landscape'));
    renderSidebar(orgWithSidebar);

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(splitOrientation()).toBe('horizontal');
  });

  it('lets a persisted position override the viewport default', async () => {
    // Force "right" even on a narrow viewport (auto would be bottom).
    localStorage.setItem(POSITION_KEY, JSON.stringify('right'));
    mockWideScreen(false);

    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(splitOrientation()).toBe('horizontal');
  });

  it('changes and persists the dock position via the dropdown', async () => {
    mockWideScreen(false); // auto → bottom
    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));
    const input = await screen.findByTestId('seer-explorer-input');
    expect(splitOrientation()).toBe('vertical');

    // The content auto-focuses the textarea ~100ms after opening. Wait for that
    // to settle first — otherwise it can steal focus from (and close) the dock
    // menu mid-interaction, dropping the selection.
    await waitFor(() => expect(input).toHaveFocus());

    await userEvent.click(screen.getByRole('button', {name: 'Dock position'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Right'}));

    await waitFor(() => expect(splitOrientation()).toBe('horizontal'));
    await waitFor(() =>
      expect(localStorage.getItem(POSITION_KEY)).toBe(JSON.stringify('right'))
    );
  });

  it('persists Seer size from a divider resize', async () => {
    // Right dock, available width 1200, default Seer 420 → content seeds to 780.
    // Growing the content pane by one keyboard step (ArrowRight, +10 → 790)
    // shrinks Seer to 1200 − 790 = 410, which is what we persist.
    mockWideScreen(true);
    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));
    const input = await screen.findByTestId('seer-explorer-input');

    // The content auto-focuses the textarea ~100ms after opening; let it settle
    // before moving focus to the divider so the keypress lands on the separator.
    await waitFor(() => expect(input).toHaveFocus());

    const separator = screen.getByRole('separator');
    separator.focus();
    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() =>
      expect(localStorage.getItem('seer-explorer-sidebar-seer-size:right')).toBe('410')
    );
  });

  it('does not persist Seer size on open (only on a real resize)', async () => {
    // Persistence runs through `onResizeEnd`, which fires only on a committed
    // drag/keyboard/double-click — never on open or the measure-driven seed. So
    // nothing is written on open; reads fall back to the default size.
    mockWideScreen(true);
    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));
    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();

    expect(localStorage.getItem('seer-explorer-sidebar-seer-size:right')).toBeNull();
  });

  it('does not clobber a saved Seer size that no longer fits the viewport', async () => {
    // Bottom dock, viewport too short to fit the saved Seer size (700) alongside
    // the content minimum. Opening must not write anything (no committed resize),
    // so the saved preference survives and is restored once the viewport has room.
    mockWideScreen(false); // auto → bottom
    jest
      .spyOn(useDimensionsModule, 'useDimensions')
      .mockReturnValue({width: 1200, height: 360});
    localStorage.setItem('seer-explorer-sidebar-seer-size:bottom', '700');

    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));
    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();

    expect(localStorage.getItem('seer-explorer-sidebar-seer-size:bottom')).toBe('700');
  });

  it('switches to the run when opened with a runId (deep link / session picker)', async () => {
    mockWideScreen(true);
    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithSidebar.slug}/seer/explorer-chat/99/`,
      method: 'GET',
      body: {session: {blocks: []}},
    });
    renderSidebar(orgWithSidebar, {runId: 99});

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    await waitFor(() =>
      expect(sessionStorageWrapper.getItem('seer-explorer-run-id')).toBe('99')
    );
  });

  it('auto-submits an initialQuery when opened (command palette)', async () => {
    mockWideScreen(true);
    renderSidebar(orgWithSidebar, {initialQuery: 'find the bug'});

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    await waitFor(() =>
      expect(defaultHookReturn.sendMessage).toHaveBeenCalledWith(
        'find the bug',
        expect.any(Number)
      )
    );
  });

  it('does not resubmit a command-palette query after close and reopen', async () => {
    mockWideScreen(true);
    renderSidebar(orgWithSidebar, {initialQuery: 'find the bug'});

    // First open auto-submits the forwarded query exactly once.
    await userEvent.click(screen.getByText('open-seer'));
    await screen.findByTestId('seer-explorer-input');
    await waitFor(() => expect(defaultHookReturn.sendMessage).toHaveBeenCalledTimes(1));

    // Close, then reopen via toggle (which forwards no query). The content
    // remounts with a fresh submit guard, so a lingering query would resubmit.
    await userEvent.click(screen.getByText('toggle-seer'));
    await waitFor(() =>
      expect(screen.queryByTestId('seer-explorer-input')).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByText('toggle-seer'));
    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();

    expect(defaultHookReturn.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('re-submits the same query when re-forwarded while open', async () => {
    mockWideScreen(true);
    renderSidebar(orgWithSidebar, {initialQuery: 'find the bug'});

    // First forward auto-submits once.
    await userEvent.click(screen.getByText('open-seer'));
    await screen.findByTestId('seer-explorer-input');
    await waitFor(() => expect(defaultHookReturn.sendMessage).toHaveBeenCalledTimes(1));

    // Forwarding the same query again (palette) starts a fresh session and must
    // submit again, even though the sidebar content stays mounted.
    await userEvent.click(screen.getByText('open-seer'));
    await waitFor(() => expect(defaultHookReturn.sendMessage).toHaveBeenCalledTimes(2));
  });

  it('tracks the global-panel-opened analytics when the sidebar opens', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    mockWideScreen(true);
    renderSidebar(orgWithSidebar);

    await userEvent.click(screen.getByText('open-seer'));
    await screen.findByTestId('seer-explorer-input');

    await waitFor(() =>
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'seer.explorer.global_panel.opened',
        expect.objectContaining({isDrawer: false})
      )
    );
  });

  it('closes the sidebar from the close button', async () => {
    mockWideScreen(true);
    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));
    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Seer'}));

    await waitFor(() =>
      expect(screen.queryByTestId('seer-explorer-input')).not.toBeInTheDocument()
    );
    expect(splitOrientation()).toBeUndefined();
  });
});
