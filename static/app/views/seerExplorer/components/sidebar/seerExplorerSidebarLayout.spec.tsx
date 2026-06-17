import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import * as useDimensionsModule from 'sentry/utils/useDimensions';
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
  overrideCtxEngEnable: true,
  overrideCodeModeEnable: 'off',
  hasSentInterrupt: false,
  sendMessage: jest.fn(),
  switchToRun: jest.fn(),
  startNewSession: jest.fn(),
  interruptRun: jest.fn(),
  respondToUserInput: jest.fn(),
  createPR: jest.fn(),
  setOverrideCtxEngEnable: jest.fn(),
  setOverrideCodeModeEnable: jest.fn(),
};

// Non-zero size so the SplitPanel isn't gated out (jsdom reports 0×0).
const CONTAINER_SIZE = {width: 1200, height: 800};

// Orientation is driven by a media query (the `xl` breakpoint).
function mockWideScreen(matches: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

function OpenSeerControl() {
  const {openSeerExplorer} = useSeerExplorerContext();
  return (
    <button type="button" onClick={() => openSeerExplorer()}>
      open-seer
    </button>
  );
}

function renderSidebar(organization: ReturnType<typeof OrganizationFixture>) {
  return render(
    <SeerExplorerSessionsProvider>
      <SeerExplorerChatStateProvider>
        <PictureInPictureProvider>
          <GlobalDrawer>
            <SeerExplorerContextProvider>
              <SeerExplorerSidebarLayout>
                <div>main app content</div>
              </SeerExplorerSidebarLayout>
              <OpenSeerControl />
            </SeerExplorerContextProvider>
          </GlobalDrawer>
        </PictureInPictureProvider>
      </SeerExplorerChatStateProvider>
    </SeerExplorerSessionsProvider>,
    {organization}
  );
}

function dividerDirection() {
  return document
    .querySelector('[data-slide-direction]')
    ?.getAttribute('data-slide-direction');
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
      url: `/organizations/${orgWithSidebar.slug}/seer/explorer-runs/`,
      method: 'GET',
      body: {data: []},
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
    expect(dividerDirection()).toBeUndefined();
    expect(screen.queryByTestId('seer-explorer-input')).not.toBeInTheDocument();
  });

  it('keeps content full-width until Seer is opened', async () => {
    renderSidebar(orgWithSidebar);

    expect(await screen.findByText('main app content')).toBeInTheDocument();
    // Closed → no split divider, no Seer content.
    expect(dividerDirection()).toBeUndefined();
    expect(screen.queryByTestId('seer-explorer-input')).not.toBeInTheDocument();
  });

  it('docks Seer to the bottom on a narrow viewport (auto)', async () => {
    mockWideScreen(false);
    renderSidebar(orgWithSidebar);

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(dividerDirection()).toBe('updown');
  });

  it('docks Seer to the right on a wide viewport (auto)', async () => {
    mockWideScreen(true);
    renderSidebar(orgWithSidebar);

    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(dividerDirection()).toBe('leftright');
  });

  it('lets a persisted position override the viewport default', async () => {
    // Force "right" even on a narrow viewport (auto would be bottom).
    localStorage.setItem(POSITION_KEY, JSON.stringify('right'));
    mockWideScreen(false);

    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(dividerDirection()).toBe('leftright');
  });

  it('changes and persists the dock position via the dropdown', async () => {
    mockWideScreen(false); // auto → bottom
    renderSidebar(orgWithSidebar);
    await userEvent.click(screen.getByText('open-seer'));
    await screen.findByTestId('seer-explorer-input');
    expect(dividerDirection()).toBe('updown');

    await userEvent.click(screen.getByRole('button', {name: 'Dock position'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Right'}));

    expect(dividerDirection()).toBe('leftright');
    await waitFor(() =>
      expect(localStorage.getItem(POSITION_KEY)).toBe(JSON.stringify('right'))
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
    expect(dividerDirection()).toBeUndefined();
  });
});
