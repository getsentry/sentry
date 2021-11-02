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

import TagsPageContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionTags(props: Props) {
  const {location, organization, projects} = props;

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.Tags}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={TagsPageContent}
      features={['performance-tag-page']}
    />
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Tags')].join(' \u2014 ');
  }

  return [t('Summary'), t('Tags')].join(' \u2014 ');
}

function generateEventView(location: Location, transactionName: string): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['transaction.duration'],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  return eventView;
}

export default withProjects(withOrganization(TransactionTags));
