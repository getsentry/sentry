import {useMemo} from 'react';

import GroupList from 'sentry/components/issues/groupList';
import {IssueCategory} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateConditions} from 'sentry/views/starfish/utils/dates';

type Props = {
  issueCategory?: IssueCategory;
  transactionName?: string;
};

function IssuesTable(props: Props) {
  const {transactionName, issueCategory} = props;
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const dateCondtions = getDateConditions(pageFilters);

  const queryConditions: string[] = [
    'is:unresolved',
    ...(issueCategory ? [`issue.category:${issueCategory}`] : ['']),
    ...(transactionName ? [`transaction:${transactionName}`] : ['']),
    ...dateCondtions,
  ];
  const queryCondtionString = queryConditions.join(' ');

  const queryParams = useMemo(
    () => ({project: 1, query: queryCondtionString, limit: 5, sort: 'new'}),
    [queryCondtionString]
  );

  return (
    <GroupList
      orgId={organization.slug}
      withChart={false}
      narrowGroups
      endpointPath={`/organizations/${organization.slug}/issues/`}
      query={queryCondtionString}
      queryParams={queryParams}
      withPagination={false}
      useTintRow
      source="starfish-endpoint-summary"
    />
  );
}

export default IssuesTable;
