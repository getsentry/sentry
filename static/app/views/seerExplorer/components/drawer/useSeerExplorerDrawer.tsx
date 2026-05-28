import {useCallback, useEffect, useMemo, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {useSeerExplorerChatDispatch} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {isSeerExplorerEnabled, usePageReferrer} from 'sentry/views/seerExplorer/utils';

export type OpenSeerExplorerDrawerOptions = {
  /**
   * Optional query string to auto-submit once the drawer opens.
   * Only takes effect on a fresh/empty session.
   */
  initialQuery?: string;
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

export const useSeerExplorerDrawer = (options?: {onClose?: () => void}) => {
  const organization = useOrganization({allowNull: true});
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const dispatch = useSeerExplorerChatDispatch();
  const {getPageReferrer} = usePageReferrer();

  // Track drawer open state in a ref so callbacks don't go stale
  const isDrawerOpenRef = useRef(false);
  useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  const onCloseCallbackRef = useRef(options?.onClose);
  onCloseCallbackRef.current = options?.onClose;

  const onOpen = useCallback(() => {
    trackAnalytics('seer.explorer.global_panel.opened', {
      referrer: getPageReferrer(),
      organization,
      isDrawer: true,
    });
  }, [getPageReferrer, organization]);

  const onClose = useCallback(() => {
    onCloseCallbackRef.current?.();
  }, []);

  const closeSeerExplorerDrawer = useCallback(() => {
    if (isDrawerOpenRef.current) {
      closeDrawer();
      onClose();
    }
  }, [closeDrawer, onClose]);

  const openSeerExplorerDrawer = useCallback(
    (drawerOptions?: OpenSeerExplorerDrawerOptions) => {
      const {runId: openRunId, startNewRun, initialQuery} = drawerOptions ?? {};

      if (initialQuery) {
        // Always start a fresh session when a query is forwarded so it
        // auto-submits into an empty conversation, even if the drawer is
        // already open with an existing run.
        dispatch({type: 'set run id', payload: null});
      } else if (isDrawerOpenRef.current) {
        return;
      } else if (openRunId !== undefined) {
        dispatch({type: 'set run id', payload: openRunId});
      } else if (startNewRun) {
        dispatch({type: 'set run id', payload: null});
      }

      openDrawer(
        () => (
          <ExplorerDrawerContent
            getPageReferrer={getPageReferrer}
            initialQuery={initialQuery}
          />
        ),
        {
          ariaLabel: t('Seer Explorer Drawer'),
          drawerKey: 'seer-explorer-drawer',
          drawerWidth: '30%',
          resizable: true,
          mode: 'passive',
          onOpen,
          onClose,
        }
      );
    },
    [openDrawer, onOpen, onClose, dispatch, getPageReferrer]
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

  if (!isSeerExplorerEnabled(organization)) {
    return disabledReturn;
  }

  return {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen: isDrawerOpen,
  };
};
