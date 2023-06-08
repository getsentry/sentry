import GroupList from 'sentry/components/issues/groupList';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IssueCategory} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';

type Props = {
  issueCategory?: IssueCategory;
  transactionName?: string;
};

function IssuesTable(props: Props) {
  const {transactionName, issueCategory} = props;
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);

  const {start, end} = normalizeDateTimeParams({
    start: startTime.toDate(),
    end: endTime.toDate(),
  });

  const queryConditions: string[] = [
    'is:unresolved',
    ...(issueCategory ? [`issue.category:${issueCategory}`] : ['']),
    ...(transactionName ? [`transaction:${transactionName}`] : ['']),
    `start:${start}`,
    `end:${end}`,
  ];

  return (
    <GroupList
      orgId={organization.slug}
      withChart={false}
      narrowGroups
      endpointPath={`/organizations/${organization.slug}/issues/`}
      query={queryConditions.join(' ')}
      queryParams={{project: 1, query: queryConditions.join(' '), limit: 5, sort: 'new'}}
      withPagination={false}
      useTintRow
      source="starfish-endpoint-summary"
    />
  );
}

export default IssuesTable;
