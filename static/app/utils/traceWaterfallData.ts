import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {
  AI_GENERATION_DESCRIPTIONS,
  AI_GENERATION_OPS,
  AI_TOOL_CALL_OPS,
  mapMissingSpanOp,
} from 'sentry/views/insights/agentMonitoring/utils/query';

export interface WaterfallSpanData extends RawSpanType {
  color: string;
  depth: number;
  description: string;
  displayText: string;
  displayTitle: string;
  duration: number;
  endTime: number;
  icon: 'tool' | 'speech' | 'http' | 'clock';
  id: string;
  // For waterfall bar width
  leftPercent: number;
  op: string;
  parentId: string | null;
  // Relative to trace start
  relativeEnd: number;
  relativeStart: number;
  startTime: number;
  // Relative to trace start
  widthPercent: number; // For waterfall bar position
}

export function createWaterfallData(spans: RawSpanType[]): WaterfallSpanData[] {
  if (spans.length === 0) return [];

  // Find the earliest start time and latest end time for normalization
  const traceStart = Math.min(...spans.map(s => s.start_timestamp));
  const traceEnd = Math.max(...spans.map(s => s.timestamp));
  const traceDuration = traceEnd - traceStart;

  // Create a map for quick parent lookup
  const spanMap = new Map<string, RawSpanType>();
  spans.forEach(span => {
    if (span.span_id) {
      spanMap.set(span.span_id, span);
    }
  });

  // Calculate depth for each span
  const getSpanDepth = (span: RawSpanType, visited = new Set<string>()): number => {
    if (!span.parent_span_id || visited.has(span.span_id || '')) {
      return 0;
    }

    visited.add(span.span_id || '');
    const parent = spanMap.get(span.parent_span_id);
    return parent ? 1 + getSpanDepth(parent, visited) : 0;
  };

  return spans
    .map(span => {
      const mappedOp = mapMissingSpanOp({
        op: span.op,
        description: span.description,
      });

      const duration = span.timestamp - span.start_timestamp;
      const relativeStart = span.start_timestamp - traceStart;
      const relativeEnd = span.timestamp - traceStart;

      // Calculate percentages for waterfall positioning
      const leftPercent = traceDuration > 0 ? (relativeStart / traceDuration) * 100 : 0;
      const widthPercent = traceDuration > 0 ? (duration / traceDuration) * 100 : 0;

      // Determine visual properties based on span type
      let icon: WaterfallSpanData['icon'] = 'clock';
      let color = 'gray400';
      let displayTitle = span.op || 'unknown';
      let displayText = span.description || '';

      if (AI_TOOL_CALL_OPS.includes(mappedOp)) {
        icon = 'tool';
        color = 'green400';
        displayTitle = span.description || 'Tool Call';
        displayText = span.data?.['ai.toolCall.name'] || '';
      } else if (
        AI_GENERATION_OPS.includes(mappedOp) ||
        AI_GENERATION_DESCRIPTIONS.includes(span.description ?? '')
      ) {
        icon = 'speech';
        color = 'blue400';
        displayTitle = span.op || 'AI Generation';
        displayText = span.description || '';
      } else if (span.op === 'http.client') {
        icon = 'http';
        color = 'gray300';
        displayTitle = span.description || 'HTTP Request';
        displayText = span.data?.['http.url'] || '';
      }

      const result = {
        ...span,
        id: span.span_id || '',
        op: span.op || '',
        description: span.description || '',
        startTime: span.start_timestamp,
        endTime: span.timestamp,
        duration,
        depth: getSpanDepth(span),
        parentId: span.parent_span_id || null,
        color,
        icon,
        displayTitle,
        displayText,
        relativeStart,
        relativeEnd,
        widthPercent: Math.max(widthPercent, 0.1), // Minimum width for visibility
        leftPercent,
      };

      return result;
    })
    .sort((a, b) => a.startTime - b.startTime); // Sort by start time
}
