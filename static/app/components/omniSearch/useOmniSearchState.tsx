import {useMemo, useState} from 'react';
import sortBy from 'lodash/sortBy';
import {PlatformIcon} from 'platformicons';

import {useSeenIssues} from 'sentry/utils/seenIssuesStorage';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {useOmniSearchStore} from './context';
import type {OmniAction, OmniArea} from './types';

export function useOmniSearchState() {
  const organization = useOrganization();
  const {actions, areaPriority, areasByKey} = useOmniSearchStore();

  const [focusedArea, setFocusedArea] = useState<OmniArea | null>(() => {
    return (
      areaPriority.map(areaKey => areasByKey.get(areaKey)).find(a => a?.focused) ?? null
    );
  });
  const [selectedAction, setSelectedAction] = useState<OmniAction | null>(null);

  const {getSeenIssues} = useSeenIssues();
  const {groupId} = useParams();

  const allRecentIssueActions: OmniAction[] = useMemo(() => {
    return getSeenIssues()
      .filter(issue => groupId !== issue.issue.id)
      .map(issue => ({
        key: `recent-issue-${issue.id}`,
        areaKey: 'recent',
        section: 'Recently Viewed',
        label: issue.issue.title || issue.issue.id,
        actionIcon: <PlatformIcon platform={issue.issue.platform} size={16} />,
        to: `/organizations/${organization.slug}/issues/${issue.id}/`,
      }));
  }, [getSeenIssues, groupId, organization.slug]);

  const areasByPriority = useMemo(
    () =>
      sortBy(Array.from(areasByKey.values()), area =>
        areaPriority.reverse().indexOf(area.key)
      ),
    [areasByKey, areaPriority]
  );

  const displayedActions = useMemo(() => {
    if (selectedAction?.children?.length) {
      return selectedAction.children?.filter(action => !action.hidden);
    }

    const globalActions = actions.filter(action => action.areaKey === 'global');

    if (focusedArea) {
      const areaActions = actions.filter(
        action => action.areaKey === focusedArea.key && !action.hidden
      );

      return [...areaActions, ...globalActions];
    }

    return [...allRecentIssueActions, ...globalActions];
  }, [selectedAction, focusedArea, actions, allRecentIssueActions]);

  return {
    actions: displayedActions,
    areas: areasByPriority,
    areaPriority,
    focusedArea,
    selectedAction,
    selectAction: setSelectedAction,
    clearSelection: () => {
      setSelectedAction(null);
      setFocusedArea(null);
    },
  };
}
