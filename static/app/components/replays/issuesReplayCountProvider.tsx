import {ReactNode, useMemo} from 'react';
import first from 'lodash/first';

import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import GroupStore from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Component to make it easier to query for replay counts against a list of groups
 * that exist across many projects.
 *
 * Later on when you want to read the fetched data:
 * ```
 * import ReplayCountContext from 'sentry/components/replays/replayCountContext';
 * const count = useContext(ReplayCountContext)[groupId];
 * ```
 */
export default function IssuesReplayCountProvider({
  children,
  groupIds,
}: {
  children: ReactNode;
  groupIds: string[];
}) {
  const organization = useOrganization();

  // Only ask for the groupIds where the project supports replay.
  // For projects that don't support replay the count will always be zero.
  const groups = useMemo(
    () =>
      groupIds
        .map(id => GroupStore.get(id) as Group)
        .filter(Boolean)
        .filter(group => projectSupportsReplay(group.project)),
    [groupIds]
  );

  // Any project that supports replay will do here.
  // Project is used to signal if we should/should not do the query at all.
  const project = first(groups)?.project;

  const counts = useReplaysCount({
    groupIds,
    organization,
    project,
  });

  return (
    <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
  );
}
