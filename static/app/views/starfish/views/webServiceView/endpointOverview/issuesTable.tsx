import {useMemo} from 'react';

import GroupList from 'sentry/components/issues/groupList';
import {IssueCategory} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';

type Props = {
  httpMethod?: string;
  issueCategory?: IssueCategory;
  transactionName?: string;
};

function IssuesTable(props: Props) {
  const {transactionName, issueCategory, httpMethod} = props;
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {statsPeriod, start, end} = getDateConditions(pageFilters.selection);

  const queryConditions: string[] = [
    'is:unresolved',
    ...(issueCategory ? [`issue.category:${issueCategory}`] : ['']),
    ...(transactionName ? [`transaction:${transactionName}`] : ['']),
    ...(httpMethod ? [`http.method:${httpMethod}`] : ['']),
  ];
  const queryCondtionString = queryConditions.join(' ');

  const queryParams = useMemo(() => {
    const dateConditions = statsPeriod ? {statsPeriod} : {start, end};
    return {
      project: 1,
      query: queryCondtionString,
      limit: 5,
      sort: 'new',
      ...dateConditions,
    };
  }, [queryCondtionString, statsPeriod, start, end]);

  return (
    <GroupList
      orgId={organization.slug}
      withChart={false}
      withColumns={[]}
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
