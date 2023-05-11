import {Fragment, ReactNode, useMemo} from 'react';

import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import GroupStore from 'sentry/stores/groupStore';
import type {Group, Organization} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

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
  const hasSessionReplay = organization.features.includes('session-replay');

  if (hasSessionReplay) {
    return (
      <Provider organization={organization} groupIds={groupIds}>
        {children}
      </Provider>
    );
  }

  return <Fragment>{children}</Fragment>;
}

function Provider({
  children,
  groupIds,
  organization,
}: Props & {organization: Organization}) {
  const [groups, projectIds] = useMemo(() => {
    const pIds = new Set<number>();
    const gIds = groupIds.map(id => GroupStore.get(id) as Group).filter(Boolean);

    return [gIds, Array.from(pIds)];
  }, [groupIds]);

  const replayGroupIds = useMemo(() => groups.map(group => group.id), [groups]);

  const counts = useReplaysCount({
    groupIds: replayGroupIds,
    organization,
    projectIds,
  });

  return (
    <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
  );
}
