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
 * React context for whether feedback(s) have a replay assiciated or not.
 *
 * You can query & read from the context via `useReplayCountForFeedbacks()`.
 */
export function ReplayCountForFeedbacks({children}: Props) {
  const organization = useOrganization();

  return (
    <ReplayCountCache
      queryKeyGenProps={{
        dataSource: 'search_issues',
        fieldName: 'issue.id',
        organization,
      }}
    >
      {children}
    </ReplayCountCache>
  );
}

/**
 * Query results for whether a Feedback has replays associated.
 */
export function useReplayCountForFeedbacks() {
  const {hasOne, hasMany} = useReplayCount();

  return {
    feedbackHasReplay: hasOne,
    feedbacksHaveReplay: hasMany,
  };
}
