import GroupList from 'sentry/components/issues/groupList';
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

  const queryConditions: string[] = [
    'is:unresolved',
    ...(issueCategory ? [`issue.category:${issueCategory}`] : ['']),
    ...(transactionName ? [`transaction:${transactionName}`] : ['']),
    `start:${startTime.format('YYYY-MM-DDTHH:mm:ss')}`,
    `end:${endTime.format('YYYY-MM-DDTHH:mm:ss')}`,
  ];

  return (
    <GroupList
      orgId={organization.slug}
      withChart={false}
      narrowGroups
      endpointPath={`/organizations/${organization.slug}/issues/`}
      query={queryConditions.join(' ')}
      useTintRow
      source="starfish-endpoint-summary"
    />
  );
}

export default IssuesTable;
