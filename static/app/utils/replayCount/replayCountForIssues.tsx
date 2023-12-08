import {ReactNode} from 'react';

import {
  ReplayCountCache,
  useReplayCount,
} from 'sentry/utils/replayCount/replayCountCache';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  children: ReactNode;
}

/**
 * React context for whether issue(s)/group(s) have a replay assiciated or not.
 *
 * You can query & read from the context via `useReplayCountForIssues()`.
 */
export function ReplayCountForIssues({children}: Props) {
  const organization = useOrganization();

  return (
    <ReplayCountCache
      queryKeyGenProps={{
        dataSource: 'discover',
        fieldName: 'issue.id',
        organization,
      }}
    >
      {children}
    </ReplayCountCache>
  );
}

/**
 * Query results for whether an Issue/Group has replays associated.
 */
export function useReplayCountForIssues() {
  const {getOne, getMany, hasOne, hasMany} = useReplayCount();

  return {
    getReplayCountForIssue: getOne,
    getReplayCountForIssues: getMany,
    issueHasReplay: hasOne,
    issuesHaveReplay: hasMany,
  };
}
