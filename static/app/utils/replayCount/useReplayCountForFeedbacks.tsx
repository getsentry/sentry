import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether a Feedback has replays associated.
 */
export default function useReplayCountForFeedbacks() {
  const organization = useOrganization();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 25,
    dataSource: 'search_issues',
    fieldName: 'issue.id',
    organization,
    statsPeriod: '90d',
  });

  return {
    feedbackHasReplay: hasOne,
    feedbacksHaveReplay: hasMany,
  };
}
