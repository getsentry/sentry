import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import PageLayout from 'sentry/views/performance/transactionSummary/pageLayout';
import Tab from 'sentry/views/performance/transactionSummary/tabs';
import {generateEventView} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';

function TransactionSummaryLayout() {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.EVENTS}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
    />
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Events')].join(' \u2014 ');
  }

  return [t('Summary'), t('Events')].join(' \u2014 ');
}

export default TransactionSummaryLayout;
