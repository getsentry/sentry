import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import PageLayout, {ChildProps} from '../pageLayout';
import Tab from '../tabs';

import ReplaysContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionVitals(props: Props) {
  const {location, organization, projects} = props;

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.Replays}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={ReplaysContentWrapper}
    />
  );
}

function ReplaysContentWrapper(props: ChildProps) {
  const {location, organization, eventView, transactionName, setError} = props;

  return (
    <DiscoverQuery
      eventView={eventView}
      orgSlug={organization.slug}
      location={location}
      setError={error => setError(error?.message)}
      referrer="api.performance.transaction-summary"
      cursor="0:0:0"
      useEvents
    >
      {({isLoading, tableData, pageLinks}) => {
        if (isLoading) {
          return (
            <Layout.Main fullWidth>
              <LoadingIndicator />
            </Layout.Main>
          );
        }
        return tableData ? (
          <ReplaysContent
            eventView={eventView}
            location={location}
            organization={organization}
            setError={setError}
            transactionName={transactionName}
            tableData={tableData}
            pageLinks={pageLinks}
          />
        ) : null;
      }}
    </DiscoverQuery>
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Replays')].join(' \u2014 ');
  }

  return [t('Summary'), t('Replays')].join(' \u2014 ');
}

function generateEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  // Default fields for relative span view
  const fields = [
    'replayId',
    'eventID',
    'project',
    'timestamp',
    'url',
    'user.display',
    'user.email',
    'user.id',
    'user.ip_address',
    'user.name',
    'user.username',
  ];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: `${conditions.formatString()} has:replayId`,
      projects: [],
      orderby: decodeScalar(location.query.sort, '-timestamp'),
    },
    location
  );
}

export default withProjects(withOrganization(TransactionVitals));
