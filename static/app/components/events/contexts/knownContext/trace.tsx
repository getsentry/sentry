import type {Location} from 'history';

import {Tooltip} from '@sentry/scraps/tooltip';

import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

enum TraceContextKeys {
  TRACE_ID = 'trace_id',
  SPAN_ID = 'span_id',
  PARENT_SPAN_ID = 'parent_span_id',
  OP_NAME = 'op',
  STATUS = 'status',
  EXCLUSIVE_TIME = 'exclusive_time',
  CLIENT_SAMPLE_RATE = 'client_sample_rate',
  DYNAMIC_SAMPLING_CONTEXT = 'dynamic_sampling_context',
  ORIGIN = 'origin',
  DATA = 'data',
}

export interface TraceContext {
  // Any custom keys users may set
  [key: string]: any;
  [TraceContextKeys.TRACE_ID]?: string;
  [TraceContextKeys.SPAN_ID]?: string;
  [TraceContextKeys.PARENT_SPAN_ID]?: string;
  [TraceContextKeys.OP_NAME]?: string;
  [TraceContextKeys.STATUS]?: string;
  [TraceContextKeys.EXCLUSIVE_TIME]?: number;
  [TraceContextKeys.CLIENT_SAMPLE_RATE]?: number;
  [TraceContextKeys.DYNAMIC_SAMPLING_CONTEXT]?: Record<string, string>;
  [TraceContextKeys.ORIGIN]?: string;
  [TraceContextKeys.DATA]?: Record<string, any>;
}

export function getTraceContextData({
  data,
  event,
  location,
  organization,
  meta,
}: {
  data: TraceContext;
  event: Event;
  location: Location;
  organization: Organization;
  meta?: Record<keyof TraceContext, any>;
}): KeyValueListData {
  return getContextKeys({data})
    .map(ctxKey => {
      switch (ctxKey) {
        case TraceContextKeys.TRACE_ID: {
          const traceId = data.trace_id || '';
          if (!traceId) {
            return undefined;
          }

          // We want to default to true for backwards compatibility, but we want to show
          // a tooltip if the trace was not sampled.
          const traceWasSampled = data?.sampled ?? true;

          if (traceWasSampled) {
            const link = generateTraceTarget(event, organization, location);
            const hasPerformanceView = organization.features.includes('performance-view');

            return {
              key: ctxKey,
              subject: t('Trace ID'),
              value: traceId,
              action: hasPerformanceView ? {link} : undefined,
            };
          }

          return {
            key: ctxKey,
            subject: t('Trace ID'),
            value: (
              <Tooltip showUnderline title={t('Trace was not sampled.')}>
                {traceId}
              </Tooltip>
            ),
          };
        }
        case TraceContextKeys.SPAN_ID: {
          return {
            key: ctxKey,
            subject: t('Span ID'),
            value: data.span_id || '',
          };
        }
        case TraceContextKeys.PARENT_SPAN_ID: {
          return {
            key: ctxKey,
            subject: t('Parent Span ID'),
            value: data.parent_span_id || '',
          };
        }
        case TraceContextKeys.OP_NAME: {
          return {
            key: ctxKey,
            subject: t('Operation Name'),
            value: data.op || '',
          };
        }
        case TraceContextKeys.STATUS: {
          return {
            key: ctxKey,
            subject: t('Status'),
            value: data.status || '',
          };
        }
        case TraceContextKeys.EXCLUSIVE_TIME: {
          return {
            key: ctxKey,
            subject: t('Exclusive Time (ms)'),
            value: data.exclusive_time,
          };
        }
        case TraceContextKeys.CLIENT_SAMPLE_RATE: {
          return {
            key: ctxKey,
            subject: t('Client Sample Rate'),
            value: data.client_sample_rate,
          };
        }
        case TraceContextKeys.DYNAMIC_SAMPLING_CONTEXT: {
          return {
            key: ctxKey,
            subject: t('Dynamic Sampling Context'),
            value: data.dynamic_sampling_context,
          };
        }
        case TraceContextKeys.ORIGIN: {
          return {
            key: ctxKey,
            subject: t('Origin'),
            value: data.origin,
          };
        }
        case TraceContextKeys.DATA: {
          return {
            key: ctxKey,
            subject: t('Data'),
            value: data.data,
          };
        }
        case 'transaction_name': {
          const eventTag = event?.tags.find(tag => {
            return tag.key === 'transaction';
          });

          if (!eventTag || typeof eventTag.value !== 'string') {
            return undefined;
          }
          const transactionName = eventTag.value;

          if (!organization.features.includes('performance-view')) {
            return {
              key: ctxKey,
              subject: t('Transaction'),
              value: transactionName,
            };
          }

          const link = transactionSummaryRouteWithQuery({
            organization,
            transaction: transactionName,
            projectID: event.projectID,
            query: {},
          });

          return {
            key: ctxKey,
            subject: t('Transaction'),
            value: transactionName,
            action: {link},
          };
        }

        default:
          return {
            key: ctxKey,
            subject: ctxKey,
            value: data[ctxKey],
            meta: meta?.[ctxKey]?.[''],
          };
      }
    })
    .filter(defined);
}
