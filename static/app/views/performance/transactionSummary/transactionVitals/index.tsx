import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import type {WebVital} from 'sentry/utils/fields';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import PageLayout from 'sentry/views/performance/transactionSummary/pageLayout';
import Tab from 'sentry/views/performance/transactionSummary/tabs';

import {makeVitalGroups, PERCENTILE} from './constants';
import VitalsContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionVitals(props: Props) {
  const {location, organization, projects} = props;
  const theme = useTheme();
  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.WEB_VITALS}
      getDocumentTitle={getDocumentTitle}
      generateEventView={({location: locationArg, transactionName}) =>
        generateEventView({location: locationArg, transactionName, theme})
      }
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
  theme,
}: {
  location: Location;
  theme: Theme;
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

  const vitals = makeVitalGroups(theme).reduce((allVitals: WebVital[], group) => {
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
