import type {Location} from 'history';

import type {Organization} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {TraceTree, TraceTreeNode} from './traceTree';

type Props = {
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
};

export const useTraceAverageTransactionDuration = ({
  node,
  location,
  organization,
}: Props) => {
  const conditions = new MutableSearch('');
  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues(' transaction', [node.value.transaction]);

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Average durations of transactions in the trace`,
    fields: ['title', 'avg(transaction.duration)'],
    orderby: '-title',
    query: conditions.formatString(),
    projects: [node.value.project_id],
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
