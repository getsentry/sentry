import {ReactNode, useMemo} from 'react';

import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
// import GroupStore from 'sentry/stores/groupStore';
// import type {Group} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  children: ReactNode;
  groupIds: string[];
};

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
export default function IssuesReplayCountProvider({children, groupIds}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const projectsById = useMemo(
    () => projects.reduce((map, p) => map.set(p.id, p), new Map()),
    [projects]
  );

  // Only ask for the groupIds where the project have sent one or more replays.
  // For projects that don't support replay the count will always be zero.
  // const [groups, projectIds] = useMemo(() => {
  //   const pIds = new Set<string>();
  //   const gIds = groupIds
  //     .map(id => GroupStore.get(id) as Group)
  //     .filter(Boolean)
  //     .filter(group => {
  //       const proj = projectsById.get(group.project?.id);
  //       if (proj?.hasReplays) {
  //         pIds.add(group.project.id);
  //         return true;
  //       }
  //       return false;
  //     });
  //   return [gIds, Array.from(pIds)];
  // }, [projectsById, groupIds]);

  // const replayGroupIds = useMemo(() => groups.map(group => group.id), [groups]);
  const replayGroupIds = groupIds;
  const projectIds = Object.keys(projectsById);

  const counts = useReplaysCount({
    groupIds: replayGroupIds,
    organization,
    projectIds,
  });

  return (
    <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
  );
}
