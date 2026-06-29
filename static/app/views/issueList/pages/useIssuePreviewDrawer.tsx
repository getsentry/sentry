import {useCallback, useEffect, useRef} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {IssuePreviewDrawer} from 'sentry/views/issueDetails/issuePreview/issuePreviewDrawer';

/**
 * Query param holding the id of the issue whose preview drawer is open.
 * Presence opens the drawer; absence closes it.
 */
const SELECTED_ISSUE_QUERY_PARAM = 'preview';

/**
 * Opens a lightweight issue preview drawer.
 * The open/selected issue state is stored in the `preview` query param.
 */
export function useIssuePreviewDrawer({enabled = true}: {enabled?: boolean} = {}) {
  const {openDrawer} = useDrawer();

  const [selectedIssueId, setSelectedIssueId] = useQueryState(
    SELECTED_ISSUE_QUERY_PARAM,
    parseAsString.withOptions({history: 'replace'})
  );

  const openIssuePreview = useCallback(
    (group: Group) => {
      setSelectedIssueId(group.id);
    },
    [setSelectedIssueId]
  );

  const lastOpenedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !selectedIssueId) {
      lastOpenedIdRef.current = null;
      return;
    }

    if (lastOpenedIdRef.current === selectedIssueId) {
      return;
    }

    lastOpenedIdRef.current = selectedIssueId;
    openDrawer(() => <IssuePreviewDrawer groupId={selectedIssueId} />, {
      ariaLabel: t('Issue preview'),
      drawerKey: 'issue-preview-drawer',
      mode: 'passive',
      shouldCloseOnLocationChange: nextLocation =>
        !nextLocation.query[SELECTED_ISSUE_QUERY_PARAM],
      onClose: () => setSelectedIssueId(null),
    });
  }, [enabled, selectedIssueId, openDrawer, setSelectedIssueId]);

  return {openIssuePreview, selectedIssueId};
}
