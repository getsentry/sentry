import {useMemo} from 'react';

import {IssueCategory} from 'sentry/types/group';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayCount from 'sentry/utils/replayCount/useReplayCount';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  bufferLimit?: number;
  statsPeriod?: string;
}

/**
 * Query results for whether an Issue/Group has replays associated.
 */
export default function useReplayCountForIssues({
  bufferLimit = 25,
  statsPeriod,
}: Props = {}) {
  const organization = useOrganization();
  const location = useLocation();
  const {
    getOne: getOneError,
    getMany: getManyError,
    hasOne: hasOneError,
    hasMany: hasManyError,
  } = useReplayCount({
    bufferLimit,
    dataSource: 'discover',
    fieldName: 'issue.id',
    organization,
    statsPeriod: statsPeriod ?? decodeScalar(location.query.statsPeriod) ?? '90d',
  });
  const {
    getOne: getOneIssue,
    getMany: getManyIssue,
    hasOne: hasOneIssue,
    hasMany: hasManyIssue,
  } = useReplayCount({
    bufferLimit,
    dataSource: 'search_issues',
    fieldName: 'issue.id',
    organization,
    statsPeriod: statsPeriod ?? decodeScalar(location.query.statsPeriod) ?? '90d',
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
