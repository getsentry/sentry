import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

export function convertRawSpanToEAPSpan(
  rawSpan: RawSpanType
): TraceTreeNode<TraceTree.EAPSpan> {
  const eapSpan: TraceTree.EAPSpan = {
    event_id: rawSpan.span_id || '',
    op: rawSpan.op || '',
    description: rawSpan.description || '',
    start_timestamp: rawSpan.start_timestamp,
    end_timestamp: rawSpan.timestamp,
    is_transaction: false, // Assuming false, adjust if needed
    project_id: 1, // Placeholder, adjust as needed
    project_slug: 'default', // Placeholder, adjust as needed
    transaction: '', // Placeholder, adjust as needed
    transaction_id: '', // Placeholder, adjust as needed
    parent_span_id: rawSpan.parent_span_id || '',
    children: [], // Convert children if needed
    errors: [], // Convert errors if needed
    occurrences: [], // Convert occurrences if needed
    duration: rawSpan.timestamp - rawSpan.start_timestamp,
    profile_id: '', // Placeholder, adjust as needed
    profiler_id: '', // Placeholder, adjust as needed
    measurements: rawSpan.data?.measurements || {},
  };

  if (eapSpan.description === 'ai.toolCall') {
    eapSpan.op = 'ai.toolCall';
    eapSpan.description = rawSpan.data?.['ai.toolCall.name'] || '';
  }

  return new TraceTreeNode<TraceTree.EAPSpan>(null, eapSpan, {
    event_id: eapSpan.event_id,
    project_slug: eapSpan.project_slug,
  });
}
