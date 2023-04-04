import {ReactNode, ReactText, useMemo} from 'react';

import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import {Organization} from 'sentry/types';

type Props = {
  children: ReactNode;
  organization: Organization;
  replayIds: ReactText[] | string[] | undefined;
};

function unique<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

const projectIds = [];

const ReplayIdCountProvider = ({children, organization, replayIds}: Props) => {
  const ids = useMemo(() => replayIds?.map(String)?.filter(Boolean) || [], [replayIds]);
  const counts = useReplaysCount({
    replayIds: unique(ids),
    organization,
    projectIds,
  });

  return (
    <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
  );
};

export default ReplayIdCountProvider;
