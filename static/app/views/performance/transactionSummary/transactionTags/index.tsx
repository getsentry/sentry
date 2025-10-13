import type {Location} from 'history';

import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import PageLayout from 'sentry/views/performance/transactionSummary/pageLayout';
import Tab from 'sentry/views/performance/transactionSummary/tabs';

import TagsPageContent from './content';

function TransactionTags() {
  return (
    <PageLayout
      tab={Tab.TAGS}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={TagsPageContent}
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

function generateEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}): EventView {
  const query = `(${decodeScalar(location.query.query, '')})`;
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);

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

export default TransactionTags;
