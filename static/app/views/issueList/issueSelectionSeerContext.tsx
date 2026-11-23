import {useMemo} from 'react';

import type {BaseGroup} from 'sentry/types/group';
import {usePublishSeerSelection} from 'sentry/views/seerExplorer/contexts/seerSelection';

import {useIssueSelectionSummary} from './issueSelectionContext';

interface Props {
  groups: readonly BaseGroup[];
  queryCount: number;
}

/**
 * Reports the issues selected in the stream to Seer, so the user can ask about them.
 */
export function IssueSelectionSeerContext({groups, queryCount}: Props) {
  const {allInQuerySelected, selectedIdsSet} = useIssueSelectionSummary();

  const selection = useMemo(() => {
    const items = groups
      .filter(group => selectedIdsSet.has(group.id))
      .map(group => ({
        shortId: group.shortId,
        title: group.title,
        issueType: group.issueType,
        project: group.project.slug,
      }));
    if (items.length === 0) {
      return null;
    }
    return {
      itemType: 'issue' as const,
      count: allInQuerySelected ? Math.max(queryCount, items.length) : items.length,
      allSelected: allInQuerySelected,
      items,
    };
  }, [allInQuerySelected, groups, queryCount, selectedIdsSet]);

  usePublishSeerSelection(selection);

  return null;
}
