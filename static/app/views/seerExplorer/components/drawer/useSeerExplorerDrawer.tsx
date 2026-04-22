import {useCallback, useEffect, useMemo, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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

export const useSeerExplorerDrawer = ({
  runId,
  setRunId,
}: {
  runId: number | null;
  setRunId: (value: number | null) => void;
}) => {
  const organization = useOrganization({allowNull: true});

  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const {getPageReferrer} = usePageReferrer();

  // Track drawer open state in a ref so callbacks don't go stale
  const isDrawerOpenRef = useRef(false);
  useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

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
    if (isDrawerOpenRef.current) {
      closeDrawer();
    }
  }, [closeDrawer]);

  const openSeerExplorerDrawer = useCallback(
    (options?: OpenSeerExplorerDrawerOptions) => {
      const {runId: openRunId, startNewRun} = options ?? {};

      if (isDrawerOpenRef.current) {
        // TODO: setting runId while drawer is open can lead to broken UI state, need to use switchToRun within DrawerContent
        return;
      }

      if (openRunId !== undefined) {
        setRunId(openRunId);
      } else if (startNewRun) {
        setRunId(null);
      }

      openDrawer(
        () => (
          <ExplorerDrawerContent
            getPageReferrer={getPageReferrer}
            runId={runId}
            setRunId={setRunId}
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
    [openDrawer, onOpen, getPageReferrer, runId, setRunId]
  );

  const toggleSeerExplorerDrawer = useCallback(() => {
    if (isDrawerOpenRef.current) {
      closeSeerExplorerDrawer();
    } else {
      openSeerExplorerDrawer();
    }
  }, [closeSeerExplorerDrawer, openSeerExplorerDrawer]);

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
