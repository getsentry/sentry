import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField, WebVital} from 'sentry/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

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

function generateEventView({
  location,
  transactionName,
  isMetricsData,
}: {
  location: Location;
  transactionName: string;
  isMetricsData: boolean;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  // event.type and transaction.op are not valid metric tags, so they will be added to the query only
  // in case the metric switch is disabled (for now).
  if (!isMetricsData) {
    conditions
      .setFilterValues('event.type', ['transaction'])
      .setFilterValues('transaction.op', ['pageload']);
  }

  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
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
