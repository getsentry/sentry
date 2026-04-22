import {useCallback, useMemo} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {isSeerExplorerEnabled, usePageReferrer} from 'sentry/views/seerExplorer/utils';

export type OpenSeerExplorerDrawerOptions = {
  /**
   * Optional run ID to open. If provided, opens an existing session.
   * Cannot be used together with `startNewRun`.
   */
  runId?: number;
  /**
   * If true, switches to a new session before opening.
   * Cannot be used together with `runId`.
   */
  startNewRun?: boolean;
};

export const useSeerExplorerDrawer = () => {
  const organization = useOrganization({allowNull: true});

  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const {getPageReferrer} = usePageReferrer();

  // TODO: add effect that opens drawer and seeds run_id from URL, remove from current URL onClose
  // (useSeerExplorer hook should no longer handle this)

  const onOpen = useCallback(() => {
    trackAnalytics('seer.explorer.global_panel.opened', {
      referrer: getPageReferrer(),
      organization,
      isDrawer: true,
    });
  }, [getPageReferrer, organization]);

  const closeSeerExplorerDrawer = useCallback(() => {
    // Prevent closing the global drawer if another drawer (e.g. autofix) is open
    if (isDrawerOpen) {
      closeDrawer();
    }
  }, [closeDrawer, isDrawerOpen]);

  const openSeerExplorerDrawer = useCallback(
    (options?: OpenSeerExplorerDrawerOptions) => {
      const {runId, startNewRun} = options ?? {};

      // Seed run_id state with sessionStorage, before rendering drawer
      try {
        if (runId !== undefined) {
          sessionStorageWrapper.setItem('seer-explorer-run-id', JSON.stringify(runId));
        } else if (startNewRun) {
          sessionStorageWrapper.removeItem('seer-explorer-run-id');
        }
      } catch {
        // Best effort
      }

      openDrawer(
        () => (
          <ExplorerDrawerContent
            onClose={closeSeerExplorerDrawer}
            getPageReferrer={getPageReferrer}
          />
        ),
        {
          ariaLabel: t('Seer Explorer Drawer'),
          drawerKey: 'seer-explorer-drawer',
          resizable: true,
          mode: 'passive',
          onOpen,
        }
      );
    },
    [openDrawer, closeSeerExplorerDrawer, onOpen, getPageReferrer]
  );

  const toggleSeerExplorerDrawer = useCallback(() => {
    if (isDrawerOpen) {
      closeSeerExplorerDrawer();
    } else {
      openSeerExplorerDrawer();
    }
  }, [closeSeerExplorerDrawer, openSeerExplorerDrawer, isDrawerOpen]);

  const disabledReturn = useMemo(
    () => ({
      openSeerExplorerDrawer: () => {},
      closeSeerExplorerDrawer: () => {},
      toggleSeerExplorerDrawer: () => {},
      isOpen: false as const,
    }),
    []
  );

  if (!organization || !isSeerExplorerEnabled(organization)) {
    return disabledReturn;
  }

  return {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen: isDrawerOpen,
  };
};
