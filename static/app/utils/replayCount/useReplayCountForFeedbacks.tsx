import {useMemo} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';

import {useReplayCount} from './useReplayCount';

/**
 * Query results for whether a Feedback has replays associated.
 */
export function useReplayCountForFeedbacks() {
  const organization = useOrganization();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 25,
    dataSource: 'search_issues',
    fieldName: 'issue.id',
    organization,
    statsPeriod: '90d',
  });

  return useMemo(
    () => ({
      feedbackHasReplay: hasOne,
      feedbacksHaveReplay: hasMany,
    }),
    [hasMany, hasOne]
  );
}
