import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

const mockOpenDrawer = jest.fn();
const mockCloseDrawer = jest.fn();

jest.mock('sentry/components/globalDrawer', () => ({
  ...jest.requireActual('sentry/components/globalDrawer'),
  useDrawer: () => ({
    openDrawer: mockOpenDrawer,
    closeDrawer: mockCloseDrawer,
  }),
}));

jest.mock('sentry/views/seerExplorer/components/drawer/explorerDrawerContent', () => ({
  ExplorerDrawerContent: () => null,
}));

const enabledOrg = OrganizationFixture({
  openMembership: true,
  features: ['seer-explorer'],
});

describe('useSeerExplorerDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('openSeerExplorerDrawer', () => {
    it('calls openDrawer with correct onOpen and onClose callbacks', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      result.current.openSeerExplorerDrawer();
      expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
      const {onOpen, onClose} = mockOpenDrawer.mock.calls[0][1];

      act(() => onOpen());
      expect(result.current.isOpen).toBe(true);

      act(() => onClose());
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('closeSeerExplorerDrawer', () => {
    it('calls closeDrawer only when the drawer is open', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      // Not open yet — should be a no-op
      result.current.closeSeerExplorerDrawer();
      expect(mockCloseDrawer).not.toHaveBeenCalled();

      // Open it, then simulate the drawer's own onOpen callback
      result.current.openSeerExplorerDrawer();
      const {onOpen} = mockOpenDrawer.mock.calls[0][1];
      act(() => onOpen());

      act(() => result.current.closeSeerExplorerDrawer());
      expect(mockCloseDrawer).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggleSeerExplorerDrawer', () => {
    it('opens the drawer when closed', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      result.current.toggleSeerExplorerDrawer();

      expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
    });

    it('closes the drawer when open', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      result.current.openSeerExplorerDrawer();
      const {onOpen} = mockOpenDrawer.mock.calls[0][1];
      act(() => onOpen()); // set isOpen to true

      mockOpenDrawer.mockClear();
      act(() => result.current.toggleSeerExplorerDrawer());

      expect(mockCloseDrawer).toHaveBeenCalledTimes(1);
      expect(mockOpenDrawer).not.toHaveBeenCalled();
    });
  });

  describe('openSeerExplorerDrawer with runId', () => {
    it('seeds sessionStorage with runId when provided', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      result.current.openSeerExplorerDrawer({runId: 99});

      expect(sessionStorageWrapper.getItem('seer-explorer-run-id')).toBe('99');
    });

    it('removes sessionStorage item when startNewRun is true', () => {
      sessionStorageWrapper.setItem('seer-explorer-run-id', '42');

      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      result.current.openSeerExplorerDrawer({startNewRun: true});

      expect(sessionStorageWrapper.getItem('seer-explorer-run-id')).toBeNull();
    });

    it('does not touch sessionStorage when no options provided', () => {
      sessionStorageWrapper.setItem('seer-explorer-run-id', '55');

      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: enabledOrg,
      });

      result.current.openSeerExplorerDrawer();

      expect(sessionStorageWrapper.getItem('seer-explorer-run-id')).toBe('55');
    });
  });

  describe('feature gating', () => {
    it('returns no-ops when seer-explorer flag is missing', () => {
      const org = OrganizationFixture({
        ...enabledOrg,
        openMembership: true,
        features: [],
      });
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: org,
      });

      result.current.openSeerExplorerDrawer();
      expect(mockOpenDrawer).not.toHaveBeenCalled();
    });

    it('returns no-ops when openMembership is false', () => {
      const org = OrganizationFixture({
        ...enabledOrg,
        openMembership: false,
        features: ['seer-explorer'],
      });
      const {result} = renderHookWithProviders(() => useSeerExplorerDrawer(), {
        organization: org,
      });

      result.current.openSeerExplorerDrawer();
      expect(mockOpenDrawer).not.toHaveBeenCalled();
    });
  });
});
