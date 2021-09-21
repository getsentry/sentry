import {Location} from 'history';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import SpansContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionSpans(props: Props) {
  const {location, organization, projects} = props;

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.Spans}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={SpansContent}
    />
  );
}

function generateEventView(location: Location, transactionName: string): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  // TODO: what should this event type be?
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['count()'],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Performance')].join(' - ');
  }

  return [t('Summary'), t('Performance')].join(' - ');
}

export default withProjects(withOrganization(TransactionSpans));
