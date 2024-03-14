import {useMemo} from 'react';

import {IssueCategory} from 'sentry/types';
import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Query results for whether an Issue/Group has replays associated.
 */
export default function useReplayCountForIssues() {
  const organization = useOrganization();
  const {
    getOne: getOneError,
    getMany: getManyError,
    hasOne: hasOneError,
    hasMany: hasManyError,
  } = useReplayCount({
    bufferLimit: 25,
    dataSource: 'discover',
    fieldName: 'issue.id',
    organization,
    statsPeriod: '14d',
  });
  const {
    getOne: getOneIssue,
    getMany: getManyIssue,
    hasOne: hasOneIssue,
    hasMany: hasManyIssue,
  } = useReplayCount({
    bufferLimit: 25,
    dataSource: 'search_issues',
    fieldName: 'issue.id',
    organization,
    statsPeriod: '14d',
  });

  return useMemo(
    () => ({
      getReplayCountForIssue: (id: string, category: IssueCategory) =>
        category === IssueCategory.ERROR ? getOneError(id) : getOneIssue(id),
      getReplayCountForIssues: (id: readonly string[], category: IssueCategory) =>
        category === IssueCategory.ERROR ? getManyError(id) : getManyIssue(id),
      issueHasReplay: (id: string, category: IssueCategory) =>
        category === IssueCategory.ERROR ? hasOneError(id) : hasOneIssue(id),
      issuesHaveReplay: (id: readonly string[], category: IssueCategory) =>
        category === IssueCategory.ERROR ? hasManyError(id) : hasManyIssue(id),
    }),
    [
      getManyError,
      getManyIssue,
      getOneError,
      getOneIssue,
      hasManyError,
      hasManyIssue,
      hasOneError,
      hasOneIssue,
    ]
  );
}
