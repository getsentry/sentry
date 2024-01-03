import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether a Feedback has replays associated.
 */
export default function useReplayCountForFeedbacks(projectIds: string[]) {
  const organization = useOrganization();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 25,
    dataSource: 'search_issues',
    fieldName: 'issue.id',
    organization,
    projectIds,
    statsPeriod: '90d',
  });

  return {
    feedbackHasReplay: hasOne,
    feedbacksHaveReplay: hasMany,
  };
}
