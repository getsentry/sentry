/* eslint-disable @sentry/scraps/restrict-types-file -- type-only imports from runtime trace model modules; extracting type leaves would cascade to their many importers */
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

export type AITraceSpanNode = TransactionNode | EapSpanNode | SpanNode;
