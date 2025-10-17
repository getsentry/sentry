import type {Location, Query} from 'history';

import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

export function replaysRouteWithQuery({
  organization,
  transaction,
  projectID,
  query,
  view,
}: {
  organization: Organization;
  query: Query;
  transaction: string;
  projectID?: string | string[];
  view?: DomainView;
}) {
  const pathname = `${getTransactionSummaryBaseUrl(organization, view)}/replays/`;

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
    },
  };
}

export function generateTransactionReplaysEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}) {
  const fields = [
    'replayId',
    'count()',
    'transaction.duration',
    'trace',
    'timestamp',
    ...SPAN_OP_BREAKDOWN_FIELDS,
    SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  ];

  return EventView.fromSavedQuery({
    id: '',
    name: `Replay events within a transaction`,
    version: 2,
    fields,
    query: `event.type:transaction transaction:"${transactionName}" !replayId:""`,
    projects: [Number(location.query.project)],
  });
}
