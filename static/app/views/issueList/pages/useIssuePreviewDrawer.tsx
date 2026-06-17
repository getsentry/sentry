import {Fragment, useCallback, useEffect, useEffectEvent, useRef} from 'react';

import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

/**
 * Query param holding the id of the issue whose preview drawer is open.
 * Presence opens the drawer; absence closes it.
 */
export const SELECTED_ISSUE_QUERY_PARAM = 'preview';

function IssuePreviewDrawer() {
  return (
    <Fragment>
      <DrawerHeader />
      <DrawerBody />
    </Fragment>
  );
}

/**
 * Opens a lightweight issue preview drawer.
 * The open/selected issue state is stored in the `preview` query param.
 */
export function useIssuePreviewDrawer({enabled = true}: {enabled?: boolean} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {openDrawer} = useDrawer();

  const selectedIssueId = decodeScalar(location.query[SELECTED_ISSUE_QUERY_PARAM]);

  const openIssuePreview = useCallback(
    (group: Group) => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            [SELECTED_ISSUE_QUERY_PARAM]: group.id,
          },
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [navigate, location.pathname, location.query]
  );

  const stripDrawerParam = useEffectEvent(() => {
    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          [SELECTED_ISSUE_QUERY_PARAM]: undefined,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  });

  const lastOpenedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !selectedIssueId) {
      lastOpenedIdRef.current = undefined;
      return;
    }

    if (lastOpenedIdRef.current === selectedIssueId) {
      return;
    }

    lastOpenedIdRef.current = selectedIssueId;
    openDrawer(() => <IssuePreviewDrawer />, {
      ariaLabel: t('Issue preview'),
      drawerKey: 'issue-preview-drawer',
      mode: 'passive',
      shouldCloseOnLocationChange: nextLocation =>
        !nextLocation.query[SELECTED_ISSUE_QUERY_PARAM],
      onClose: () => stripDrawerParam(),
    });
  }, [enabled, selectedIssueId, openDrawer]);

  return {openIssuePreview, selectedIssueId};
}
