import {Location} from 'history';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {isAggregateField, WebVital} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import {PERCENTILE, VITAL_GROUPS} from './constants';
import VitalsContent from './content';

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
      tab={Tab.WebVitals}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={VitalsContent}
    />
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Vitals')].join(' \u2014 ');
  }

  return [t('Summary'), t('Vitals')].join(' \u2014 ');
}

function generateEventView(location: Location, transactionName: string): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction.op', ['pageload'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
  });

  const vitals = VITAL_GROUPS.reduce((allVitals: WebVital[], group) => {
    return allVitals.concat(group.vitals);
  }, []);

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [
        ...vitals.map(vital => `percentile(${vital}, ${PERCENTILE})`),
        ...vitals.map(vital => `count_at_least(${vital}, 0)`),
        ...vitals.map(
          vital => `count_at_least(${vital}, ${WEB_VITAL_DETAILS[vital].poorThreshold})`
        ),
      ],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

export default withProjects(withOrganization(TransactionVitals));
