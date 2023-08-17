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
  const projects = pageFilters.selection.projects;

  const queryConditions: string[] = [
    'is:unresolved',
    ...(issueCategory ? [`issue.category:${issueCategory}`] : ['']),
    ...(transactionName ? [`transaction:${transactionName}`] : ['']),
    ...(httpMethod ? [`http.method:${httpMethod}`] : ['']),
  ];
  const queryConditionString = queryConditions.join(' ');

  const queryParams = useMemo(() => {
    const dateConditions = statsPeriod ? {statsPeriod} : {start, end};
    return {
      project: projects[0],
      query: queryConditionString,
      limit: 5,
      sort: 'new',
      ...dateConditions,
    };
  }, [queryConditionString, statsPeriod, start, end, projects]);

  return (
    <GroupList
      orgSlug={organization.slug}
      withChart={false}
      withColumns={[]}
      narrowGroups
      endpointPath={`/organizations/${organization.slug}/issues/`}
      query={queryConditionString}
      queryParams={queryParams}
      withPagination={false}
      useTintRow
      source="starfish-endpoint-summary"
    />
  );
}

export default IssuesTable;
