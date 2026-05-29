import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import type {
  RawSpanType,
  TraceContextSpanProxy,
} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import type {Entry, EntrySpans, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {KeyValueListDataItem} from 'sentry/types/group';

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';
const MAX_VISIBLE_TRACE_PATH_LINES = 6;

export type SpanEvidenceTraceSpan = (RawSpanType | TraceContextSpanProxy) & {
  data?: any;
  start_timestamp?: number;
  timestamp?: number;
};

export type TracePathLine = {
  depth: number;
  label: string;
  kindLabel?: string;
};

export function makeTracePathRow(
  event: EventTransaction,
  targetSpan: SpanEvidenceTraceSpan,
  targetSpanLabel?: string,
  appendedLabel?: string
): KeyValueListDataItem | null {
  const tracePathLines = getTracePathLines(event, targetSpan, targetSpanLabel);

  if (!tracePathLines) {
    return null;
  }

  if (appendedLabel) {
    const lastLine = tracePathLines[tracePathLines.length - 1]!;
    tracePathLines.push({
      depth: lastLine.depth + 1,
      kindLabel: t('Evidence'),
      label: appendedLabel,
    });
  }

  return {
    key: 'trace-path',
    subject: t('Trace Path'),
    value: <TracePath lines={tracePathLines} />,
    subjectDataTestId: `${TEST_ID_NAMESPACE}.trace-path`,
  };
}

const isSpanEntry = (entry: Entry): entry is EntrySpans => {
  return entry.type === EntryType.SPANS;
};

export function getTracePathLines(
  event: EventTransaction,
  targetSpan: SpanEvidenceTraceSpan,
  targetSpanLabel?: string
): TracePathLine[] | null {
  const traceContext = event.contexts?.trace;
  const traceRootSpanId = traceContext?.span_id;
  const spanEntry = event.entries.find(isSpanEntry);
  const spans: SpanEvidenceTraceSpan[] = [...(spanEntry?.data ?? [])];

  if (traceContext) {
    spans.push(traceContext as TraceContextSpanProxy);
  }

  const spansById = new Map(spans.map(span => [span.span_id, span]));
  const path: SpanEvidenceTraceSpan[] = [];
  const visitedSpanIds = new Set<string>();
  let currentSpan: SpanEvidenceTraceSpan | undefined = targetSpan;

  while (currentSpan && !visitedSpanIds.has(currentSpan.span_id)) {
    visitedSpanIds.add(currentSpan.span_id);
    path.unshift(currentSpan);

    if (currentSpan.span_id === traceRootSpanId || !currentSpan.parent_span_id) {
      break;
    }

    currentSpan = spansById.get(currentSpan.parent_span_id);
  }

  const spanLines = path
    .filter(span => span.span_id !== traceRootSpanId)
    .map(
      span =>
        ({
          kindLabel: getTracePathSpanKindLabel(span),
          label:
            span.span_id === targetSpan.span_id && targetSpanLabel
              ? targetSpanLabel
              : getTracePathSpanLabel(span),
        }) satisfies Pick<TracePathLine, 'kindLabel' | 'label'>
    );

  if (spanLines.length === 0) {
    return null;
  }

  return [{kindLabel: t('Transaction'), label: event.title}, ...spanLines].map(
    (line, depth) => ({...line, depth})
  );
}

function getTracePathSpanKindLabel(span: SpanEvidenceTraceSpan): string {
  const op = span.op ?? '';

  if (op.startsWith('db')) {
    return t('Database');
  }

  if (op === 'http.server') {
    return t('HTTP Server');
  }

  if (op.startsWith('http')) {
    return t('HTTP Client');
  }

  if (op.startsWith('resource')) {
    return t('Resource');
  }

  if (op.includes('function')) {
    return t('Function');
  }

  if (op.includes('middleware')) {
    return t('Middleware');
  }

  if (op.includes('rpc')) {
    return t('RPC');
  }

  if (op.includes('cache')) {
    return t('Cache');
  }

  return t('Span');
}

function getTracePathSpanLabel(span: SpanEvidenceTraceSpan): string {
  const label = span.description ?? span.op ?? span.span_id;
  const normalizedLabel = String(label).replace(/\s+/g, ' ').trim();
  const maxLength = 160;

  if (normalizedLabel.length <= maxLength) {
    return normalizedLabel;
  }

  return `${normalizedLabel.slice(0, maxLength - 1)}…`;
}

function TracePath({lines}: {lines: TracePathLine[]}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = lines.length > MAX_VISIBLE_TRACE_PATH_LINES;
  const visibleLines =
    shouldCollapse && !isExpanded ? getCollapsedTracePathLines(lines) : lines;

  return (
    <TracePathContainer gap="xs" align="start">
      <TracePathPre>
        {visibleLines.map(line => (
          <Fragment key={`${line.depth}-${line.label}`}>
            {formatTracePathLine(line)}
            {'\n'}
          </Fragment>
        ))}
      </TracePathPre>
      {shouldCollapse ? (
        <Button
          size="xs"
          variant="link"
          onClick={() => setIsExpanded(expanded => !expanded)}
        >
          {isExpanded ? t('Show less') : t('Show full path')}
        </Button>
      ) : null}
    </TracePathContainer>
  );
}

function getCollapsedTracePathLines(lines: TracePathLine[]): TracePathLine[] {
  const head = lines.slice(0, 2);
  const tail = lines.slice(-3);
  const hiddenCount = lines.length - head.length - tail.length;

  return [
    ...head,
    {depth: head.length, label: t('… %s spans hidden', hiddenCount)},
    ...tail,
  ];
}

function formatTracePathLine({depth, label}: TracePathLine): string {
  return `${depth === 0 ? '' : `${'  '.repeat(depth)}→ `}${label}`;
}

const TracePathContainer = styled(Stack)`
  width: 100%;
`;

const TracePathPre = styled('pre')`
  margin: 0;
  width: 100%;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
