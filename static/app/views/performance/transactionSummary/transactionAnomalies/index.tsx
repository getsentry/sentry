import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import AnomaliesContent from './content';
import {generateAnomaliesEventView} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionAnomalies(props: Props) {
  const {location, organization, projects} = props;

  return (
    <MEPSettingProvider>
      <PageLayout
        location={location}
        organization={organization}
        projects={projects}
        tab={Tab.ANOMALIES}
        generateEventView={generateAnomaliesEventView}
        getDocumentTitle={getDocumentTitle}
        childComponent={AnomaliesContent}
      />
    </MEPSettingProvider>
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

export default withProjects(withOrganization(TransactionAnomalies));
