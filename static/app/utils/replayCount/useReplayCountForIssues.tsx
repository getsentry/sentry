import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether an Issue/Group has replays associated.
 */
export default function useReplayCountForIssues(projectIds: [string]) {
  const organization = useOrganization();
  const {getOne, getMany, hasOne, hasMany} = useReplayCount({
    bufferLimit: 25,
    dataSource: 'discover',
    fieldName: 'issue.id',
    organization,
    projectIds,
    statsPeriod: '90d',
  });

  return {
    getReplayCountForIssue: getOne,
    getReplayCountForIssues: getMany,
    issueHasReplay: hasOne,
    issuesHaveReplay: hasMany,
  };
}
