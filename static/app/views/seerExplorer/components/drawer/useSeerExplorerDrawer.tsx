import {useCallback, useState} from 'react';
import {css} from '@emotion/react';

import {useDrawer} from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {isSeerExplorerEnabled, RUN_ID_QUERY_PARAM} from 'sentry/views/seerExplorer/utils';

export const useSeerExplorerDrawer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {openDrawer, closeDrawer} = useDrawer();

  // TODO: add effect that opens drawer when query param is present (useSeerExplorer hook should no longer consume the param)
  // Needs an enabled flag if we FF drawer version

  const [isExplorerDrawerOpen, setIsExplorerDrawerOpen] = useState(false);

  const onClose = useCallback(() => {
    setIsExplorerDrawerOpen(false);
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

  const openSeerExplorerDrawer = useCallback(() => {
    openDrawer(() => <ExplorerDrawerContent />, {
      ariaLabel: t('Seer Explorer drawer'),
      drawerKey: 'seer-explorer-drawer',
      drawerCss: css`
        height: fit-content;
        max-height: 100%;
      `,
      resizable: true,
      closeOnOutsideClick: false,
      shouldLockScroll: false,
      onClose: () => onClose?.(),
    });
    setIsExplorerDrawerOpen(true);
  }, [openDrawer, onClose]);

  const closeSeerExplorerDrawer = useCallback(() => {
    // Prevent closing the global drawer if another drawer is open
    if (isExplorerDrawerOpen) {
      closeDrawer();
      onClose?.();
    }
  }, [isExplorerDrawerOpen, closeDrawer, onClose]);

  const toggleSeerExplorerDrawer = useCallback(() => {
    if (isExplorerDrawerOpen) {
      closeSeerExplorerDrawer();
    } else {
      openSeerExplorerDrawer();
    }
  }, [isExplorerDrawerOpen, closeSeerExplorerDrawer, openSeerExplorerDrawer]);

  if (
    !organization ||
    organization.hideAiFeatures ||
    !organization.features.includes('gen-ai-features') ||
    !isSeerExplorerEnabled(organization)
  ) {
    return {
      openSeerExplorerDrawer: () => {},
      closeSeerExplorerDrawer: () => {},
      toggleSeerExplorerDrawer: () => {},
    };
  }

  return {openSeerExplorerDrawer, closeSeerExplorerDrawer, toggleSeerExplorerDrawer};
};
