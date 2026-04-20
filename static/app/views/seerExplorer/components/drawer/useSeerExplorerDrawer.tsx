import {useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';

import {useDrawer} from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {
  isSeerExplorerEnabled,
  RUN_ID_QUERY_PARAM,
  usePageReferrer,
} from 'sentry/views/seerExplorer/utils';

export const useSeerExplorerDrawer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const {openDrawer, closeDrawer} = useDrawer();
  const {getPageReferrer} = usePageReferrer();

  // TODO: add effect that opens drawer and seeds run_id from URL
  // (useSeerExplorer hook should no longer handle this)

  const [isOpen, setIsOpen] = useState(false); // for hook users
  const isOpenRef = useRef(false); // for callback accuracy

  const onOpen = useCallback(() => {
    isOpenRef.current = true;
    setIsOpen(true);
    trackAnalytics('seer.explorer.global_panel.opened', {
      referrer: getPageReferrer(),
      organization,
      isDrawer: true,
    });
  }, [getPageReferrer, organization]);

  const onClose = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          [RUN_ID_QUERY_PARAM]: undefined,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  }, [location, navigate]);

  const closeSeerExplorerDrawer = useCallback(() => {
    // Prevent closing the global drawer if another drawer (e.g. autofix) is open
    if (isOpenRef.current) {
      closeDrawer();
      onClose();
    }
  }, [closeDrawer, onClose]);

  const openSeerExplorerDrawer = useCallback(() => {
    openDrawer(
      () => (
        <ExplorerDrawerContent
          onClose={closeSeerExplorerDrawer}
          getPageReferrer={getPageReferrer}
        />
      ),
      {
        ariaLabel: t('Seer Explorer drawer'),
        drawerKey: 'seer-explorer-drawer',
        drawerCss: css`
          height: 100%;
          max-height: 100%;
        `,
        resizable: true,
        closeOnOutsideClick: false,
        shouldLockScroll: false,
        // XXX: be sure to update isOpenRef if closing on change is needed. useDrawer doesn't call onClose
        shouldCloseOnLocationChange: () => false,
        onOpen,
        onClose,
      }
    );
  }, [openDrawer, closeSeerExplorerDrawer, onOpen, onClose, getPageReferrer]);

  const toggleSeerExplorerDrawer = useCallback(() => {
    if (isOpenRef.current) {
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

  if (
    !organization ||
    organization.hideAiFeatures ||
    !organization.features.includes('gen-ai-features') ||
    !isSeerExplorerEnabled(organization)
  ) {
    return disabledReturn;
  }

  return {
    openSeerExplorerDrawer,
    closeSeerExplorerDrawer,
    toggleSeerExplorerDrawer,
    isOpen,
  };
};
