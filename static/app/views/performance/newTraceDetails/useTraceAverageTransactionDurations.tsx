import {useMemo} from 'react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {TraceTree} from './traceTree';

type Props = {
  location: Location;
  organization: Organization;
  tree: TraceTree;
};

export const useTraceAverageTransactionDurations = ({
  tree,
  location,
  organization,
}: Props) => {
  const transactionTitles = useMemo(
    () => [...tree.transactionTitles],
    [tree.transactionTitles]
  );

  const transactionProjectIDs = useMemo(
    () => [...tree.transactionProjectIDs],
    [tree.transactionProjectIDs]
  );

  const conditions = new MutableSearch(
    transactionTitles.reduce<string[]>((acc, transaction, index, allTransactions) => {
      acc.push(`transaction:"${transaction}"`);
      if (index < allTransactions.length - 1) {
        acc.push('OR');
      }
      return acc;
    }, [])
  );
  conditions.setFilterValues('event.type', ['transaction']);

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Average durations of transactions in the trace`,
    fields: ['title', 'avg(transaction.duration)'],
    orderby: '-title',
    query: conditions.formatString(),
    projects: transactionProjectIDs,
    version: 2,
    start: undefined,
    end: undefined,
    range: '24h',
  });

  return useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
  });
};
