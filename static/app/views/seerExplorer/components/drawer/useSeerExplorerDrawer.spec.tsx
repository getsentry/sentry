import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';

jest.mock('sentry/views/seerExplorer/components/drawer/explorerDrawerContent', () => ({
  ExplorerDrawerContent: () => <div data-seer-explorer-root="" />,
}));

jest.mock('sentry/views/seerExplorer/utils', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/utils'),
  usePageReferrer: () => ({getPageReferrer: () => '/issues/'}),
}));

jest.mock('sentry/views/seerExplorer/hooks/useSeerExplorerPolling', () => ({
  useSeerExplorerPolling: () => ({
    pollingState: 'not-polling',
    apiData: undefined,
    isError: false,
    errorStatusCode: undefined,
    isPolling: false,
    isTimedOut: false,
  }),
}));

const DRAWER_LABEL = 'Seer Explorer Drawer';

const enabledOrg = OrganizationFixture({
  openMembership: true,
  features: ['seer-explorer', 'gen-ai-features'],
  hideAiFeatures: false,
});

function queryDrawer(): HTMLElement | null {
  return screen.queryByRole('complementary', {name: DRAWER_LABEL});
}

function findDrawer(): Promise<HTMLElement> {
  return screen.findByRole('complementary', {name: DRAWER_LABEL});
}

describe('useSeerExplorerDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('openSeerExplorerDrawer', () => {
    it('opens the Seer Explorer drawer', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer());

      expect(await findDrawer()).toBeInTheDocument();
      expect(document.querySelector('[data-seer-explorer-root]')).toBeInTheDocument();
    });

    it('sets isOpen to true after opening', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer());

      await waitFor(() => expect(result.current.isOpen).toBe(true));
    });

    it('seeds sessionStorage with runId when provided', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer({runId: 99}));

      expect(sessionStorageWrapper.getItem('seer-explorer-run-id')).toBe('99');
    });

    it('clears runId when startNewRun is true', () => {
      sessionStorageWrapper.setItem('seer-explorer-run-id', '42');

      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer({startNewRun: true}));

      // setRunId(null) writes JSON.stringify(null) = "null"; parsing it back gives null
      expect(
        JSON.parse(sessionStorageWrapper.getItem('seer-explorer-run-id')!)
      ).toBeNull();
    });

    it('does not touch sessionStorage when no options provided', () => {
      sessionStorageWrapper.setItem('seer-explorer-run-id', '55');

      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer());

      expect(sessionStorageWrapper.getItem('seer-explorer-run-id')).toBe('55');
    });
  });

  describe('closeSeerExplorerDrawer', () => {
    it('is a no-op when the drawer is not open', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      expect(result.current.isOpen).toBe(false);
      expect(queryDrawer()).not.toBeInTheDocument();

      act(() => result.current.closeSeerExplorerDrawer());
      expect(result.current.isOpen).toBe(false);
      expect(queryDrawer()).not.toBeInTheDocument();
    });

    it('closes the drawer when open', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer());
      await findDrawer();

      act(() => result.current.closeSeerExplorerDrawer());

      await waitFor(() => expect(queryDrawer()).not.toBeInTheDocument());
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggleSeerExplorerDrawer', () => {
    it('opens the drawer when closed', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.toggleSeerExplorerDrawer());

      expect(await findDrawer()).toBeInTheDocument();
    });

    it('closes the drawer when open', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        additionalWrapper: SeerExplorerChatStateProvider,
        organization: enabledOrg,
      });

      act(() => result.current.openSeerExplorerDrawer());
      await waitFor(() => expect(result.current.isOpen).toBe(true));

      act(() => result.current.toggleSeerExplorerDrawer());

      await waitFor(() => expect(queryDrawer()).not.toBeInTheDocument());
    });
  });
});
