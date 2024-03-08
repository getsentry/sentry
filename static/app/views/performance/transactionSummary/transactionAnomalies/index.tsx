import type {Location} from 'history';

import {t} from 'sentry/locale';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import PageLayout from '../pageLayout';
import Tab from '../tabs';

import AnomaliesContent from './content';
import {generateAnomaliesEventView} from './utils';

type Props = {
  location: Location;
};

export default function TransactionAnomalies({location}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

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
