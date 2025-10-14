import {useMatches} from 'react-router-dom';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import PageLayout from 'sentry/views/performance/transactionSummary/pageLayout';
import Tab from 'sentry/views/performance/transactionSummary/tabs';
import {generateTransactionEventsEventView} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';
import {generateTransactionOverviewEventView} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

function TransactionSummaryLayout() {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const handle = useMatches().at(-1)?.handle as {tab?: Tab} | undefined;

  if (!handle?.tab) {
    return null;
  }

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={handle.tab}
      getDocumentTitle={makeGetDocumentTitle(handle.tab)}
      generateEventView={makeGenerateEventView(handle.tab)}
    />
  );
}

function makeGenerateEventView(tab: Tab) {
  switch (tab) {
    case Tab.TRANSACTION_SUMMARY:
      return generateTransactionOverviewEventView;
      break;
    case Tab.EVENTS:
      return generateTransactionEventsEventView;
    default:
      throw new Error('Unknown tab');
  }
}

function makeGetDocumentTitle(tab: Tab) {
  let name = '';
  switch (tab) {
    case Tab.TRANSACTION_SUMMARY:
      name = t('Performance');
      break;
    case Tab.EVENTS:
      name = t('Events');
      break;
    default:
      name = '';
  }

  return function getDocumentTitle(transactionName: string): string {
    const hasTransactionName =
      typeof transactionName === 'string' && String(transactionName).trim().length > 0;

    if (hasTransactionName) {
      return [String(transactionName).trim(), name].join(' \u2014 ');
    }

    return [t('Summary'), name].join(' \u2014 ');
  };
}

export default TransactionSummaryLayout;
