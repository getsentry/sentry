import {useMemo} from 'react';

import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';
import {usePublishSeerSelection} from 'sentry/views/seerExplorer/contexts/seerSelection';

interface Props {
  replays: ReplayListRecord[];
}

/**
 * Reports the replays selected in the list to Seer, so the user can ask about them.
 */
export function ReplaySelectionSeerContext({replays}: Props) {
  const {selectedIds} = useListItemCheckboxContext();

  const selection = useMemo(() => {
    const allSelected = selectedIds === 'all';
    const selected = allSelected
      ? replays
      : replays.filter(replay => selectedIds.includes(replay.id));
    if (selected.length === 0) {
      return null;
    }
    return {
      itemType: 'replay' as const,
      count: selected.length,
      allSelected,
      items: selected.map(replay => ({
        id: replay.id,
        projectId: replay.project_id,
        startedAt: replay.started_at?.toISOString() ?? null,
        durationSeconds: replay.duration?.asSeconds() ?? null,
        errors: replay.count_errors,
      })),
    };
  }, [replays, selectedIds]);

  usePublishSeerSelection(selection);

  return null;
}
