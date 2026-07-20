import {useMatches} from 'react-router-dom';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {PageLayout} from 'sentry/views/performance/transactionSummary/pageLayout';
import {Tab} from 'sentry/views/performance/transactionSummary/tabs';

function TransactionSummaryLayout() {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const handle = useMatches().at(-1)?.handle as {tab?: Tab} | undefined;

  if (!handle?.tab) {
    throw new Error('Transaction Summary Layout was rendered without a tab');
  }

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={handle.tab}
      getDocumentTitle={makeGetDocumentTitle(handle.tab)}
      fillSpace={handle.tab === Tab.PROFILING}
    />
  );
}

function makeGetDocumentTitle(tab: Tab) {
  if (tab === Tab.PROFILING) {
    return (transactionName: string) => t('Profile: %s', transactionName);
  }

  let name = '';
  switch (tab) {
    case Tab.TRANSACTION_SUMMARY:
      name = t('Performance');
      break;
    case Tab.EVENTS:
      name = t('Events');
      break;
    case Tab.REPLAYS:
      name = t('Replays');
      break;
    default:
      Sentry.captureException(new Error('Unknown Transaction Summary Tab: ' + tab));
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
