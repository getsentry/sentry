import type {ReactNode} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconChevron, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {SQLishFormatter} from 'sentry/utils/sqlish';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {
  getTracePathLines,
  type SpanEvidenceTraceSpan,
  type TracePathLine,
} from './spanEvidenceTracePath';

const formatter = new SQLishFormatter();

type SpanEvidenceTraceStackProps = {
  event: EventTransaction;
  offendingSpans: SpanEvidenceTraceSpan[];
  organization: Organization;
  collapseEvidenceLabel?: string;
  evidenceBadges?: ReactNode[];
  evidenceTitle?: string;
  expandEvidenceLabel?: string;
  location?: Location;
  parentSpan?: SpanEvidenceTraceSpan | null;
  patternSize?: number;
  precedingSpan?: SpanEvidenceTraceSpan | null;
  projectSlug?: string;
  sqlStatements?: string[];
};

export function SpanEvidenceTraceStack({
  event,
  collapseEvidenceLabel,
  evidenceBadges,
  evidenceTitle,
  expandEvidenceLabel,
  offendingSpans,
  organization,
  location,
  parentSpan,
  patternSize,
  precedingSpan,
  projectSlug,
  sqlStatements,
}: SpanEvidenceTraceStackProps) {
  const targetSpan = parentSpan ?? offendingSpans[0];

  if (!targetSpan) {
    return null;
  }

  const terminalLabel =
    evidenceTitle ?? t('Repeating DB Queries (%s)', offendingSpans.length);
  const tracePathLines =
    getTracePathLines(event, targetSpan, parentSpan ? undefined : terminalLabel) ?? [];

  if (parentSpan && tracePathLines.length > 0) {
    const lastLine = tracePathLines[tracePathLines.length - 1]!;
    tracePathLines.push({
      depth: lastLine.depth + 1,
      kindLabel: t('Evidence'),
      label: terminalLabel,
    });
  }

  const evidenceSqlStatements = Array.from(
    new Set(
      (sqlStatements ?? offendingSpans.map(span => span.description)).filter(Boolean)
    )
  ) as string[];
  const metadataBadges =
    evidenceBadges ??
    [
      patternSize ? t('Pattern Size %s', patternSize) : null,
      evidenceSqlStatements.length > 1
        ? t('%s query shapes', evidenceSqlStatements.length)
        : null,
    ].filter(Boolean);

  if (tracePathLines.length === 0) {
    return null;
  }

  return (
    <TraceStack data-test-id="span-evidence-trace-stack-example">
      {tracePathLines.map((line, index) => {
        if (index === 0) {
          return (
            <TransactionFrame
              key={`${line.depth}-${line.label}`}
              event={event}
              location={location}
              organization={organization}
              line={line}
              projectSlug={projectSlug}
            />
          );
        }

        const isTerminal = index === tracePathLines.length - 1;

        if (isTerminal) {
          return (
            <Fragment key={`${line.depth}-${line.label}`}>
              {precedingSpan ? (
                <ExpandablePrecedingSpanFrame depth={line.depth} span={precedingSpan} />
              ) : null}
              <ExpandableEvidenceFrame
                collapseLabel={collapseEvidenceLabel}
                expandLabel={expandEvidenceLabel}
                line={line}
                metadataBadges={metadataBadges}
                sqlStatements={evidenceSqlStatements}
              />
            </Fragment>
          );
        }

        return <TraceFrame key={`${line.depth}-${line.label}`} line={line} />;
      })}
    </TraceStack>
  );
}

function ExpandablePrecedingSpanFrame({
  depth,
  span,
}: {
  depth: number;
  span: SpanEvidenceTraceSpan;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDatabaseSpan = span.op?.startsWith('db');

  return (
    <EvidenceFrame>
      <EvidenceHeadingRow depth={depth}>
        <ChevronSlot>
          <ArrowMarker>→</ArrowMarker>
        </ChevronSlot>
        <EvidenceHeading as="div" bold size="sm">
          {t('Preceding Span')}
        </EvidenceHeading>
        <Button
          size="zero"
          variant="transparent"
          aria-label={isExpanded ? t('Hide preceding span') : t('Show preceding span')}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(expanded => !expanded)}
        >
          <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
        </Button>
      </EvidenceHeadingRow>
      {isExpanded ? (
        <EvidencePanel>
          {isDatabaseSpan && span.description ? (
            <StyledCodeBlock language="sql">
              {formatter.toString(span.description)}
            </StyledCodeBlock>
          ) : span.description ? (
            <SpanDetails>
              <InlineLabel as="span" size="sm" variant="muted">
                {t('Description')}
              </InlineLabel>
              {span.description}
            </SpanDetails>
          ) : (
            <SpanDetails>
              <InlineLabel as="span" size="sm" variant="muted">
                {t('Span ID')}
              </InlineLabel>
              {span.span_id}
            </SpanDetails>
          )}
        </EvidencePanel>
      ) : null}
    </EvidenceFrame>
  );
}

function TransactionFrame({
  event,
  location,
  organization,
  line,
  projectSlug,
}: {
  event: EventTransaction;
  line: TracePathLine;
  organization: Organization;
  location?: Location;
  projectSlug?: string;
}) {
  const transactionSummaryLocation = transactionSummaryRouteWithQuery({
    organization,
    projectID: event.projectID,
    transaction: event.title,
    query: {},
  });

  const traceSlug = event.contexts?.trace?.trace_id ?? '';
  const eventDetailsLocation =
    location && projectSlug
      ? generateLinkToEventInTraceView({
          traceSlug,
          eventId: event.eventID,
          timestamp: event.endTimestamp ?? '',
          location,
          organization,
        })
      : null;

  return (
    <TransactionRow
      depth={line.depth}
      data-test-id="span-evidence-trace-stack.transaction"
    >
      <TransactionLabel align="center" gap="xs">
        <InlineLabel as="span" size="sm" variant="muted">
          {line.kindLabel ?? t('Transaction')}
        </InlineLabel>
        <TransactionNameText as="span" ellipsis size="sm" title={line.label}>
          <Link to={transactionSummaryLocation}>{line.label}</Link>
        </TransactionNameText>
      </TransactionLabel>
      {eventDetailsLocation ? (
        <LinkButton size="xs" to={eventDetailsLocation}>
          {t('View Full Trace')}
        </LinkButton>
      ) : null}
    </TransactionRow>
  );
}

function TraceFrame({line}: {line: TracePathLine}) {
  return (
    <FrameRow depth={line.depth}>
      <ChevronSlot>
        <ArrowMarker>→</ArrowMarker>
      </ChevronSlot>
      <FrameLabel as="div" size="sm">
        <InlineLabel as="span" size="sm" variant="muted">
          {line.kindLabel ?? t('Span')}
        </InlineLabel>
        {line.label}
      </FrameLabel>
    </FrameRow>
  );
}

function ExpandableEvidenceFrame({
  collapseLabel,
  expandLabel,
  line,
  metadataBadges,
  sqlStatements,
}: {
  line: TracePathLine;
  metadataBadges: ReactNode[];
  sqlStatements: string[];
  collapseLabel?: string;
  expandLabel?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hideLabel = collapseLabel ?? t('Hide repeated queries');
  const showLabel = expandLabel ?? t('Show repeated queries');

  return (
    <EvidenceFrame>
      <EvidenceHeadingRow depth={line.depth}>
        <ChevronSlot>
          <IconWarning size="xs" variant="warning" />
        </ChevronSlot>
        <EvidenceHeading as="div" bold size="sm">
          {line.label}
        </EvidenceHeading>
        {metadataBadges.map((badge, index) => (
          <MetadataBadge key={index}>{badge}</MetadataBadge>
        ))}
        <Button
          size="zero"
          variant="transparent"
          aria-label={isExpanded ? hideLabel : showLabel}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(expanded => !expanded)}
        >
          <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
        </Button>
      </EvidenceHeadingRow>
      {isExpanded ? (
        <EvidencePanel>
          <QueryList>
            {sqlStatements.map(query => (
              <QueryShape key={query}>
                <StyledCodeBlock language="sql">
                  {formatter.toString(query)}
                </StyledCodeBlock>
              </QueryShape>
            ))}
          </QueryList>
        </EvidencePanel>
      ) : null}
    </EvidenceFrame>
  );
}

const INDENT_WIDTH = 18;
const BASE_ROW_PADDING = 2;

const TraceStack = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;

  > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const EvidenceFrame = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
`;

const FrameRow = styled(Flex)<{depth: number}>`
  align-items: center;
  gap: ${p => p.theme.space.sm};
  min-height: 30px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  padding-left: ${p => `${BASE_ROW_PADDING + p.depth * INDENT_WIDTH}px`};
`;

const TransactionRow = styled(FrameRow)`
  padding-left: ${p => p.theme.space.md};
`;

const EvidenceHeadingRow = styled(FrameRow)`
  min-height: 34px;
  padding-top: ${p => p.theme.space.xs};
  padding-bottom: ${p => p.theme.space.xs};
`;

const ChevronSlot = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  min-width: 16px;
`;

const ArrowMarker = styled('span')`
  color: ${p => p.theme.tokens.content.muted};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1;
`;

const FrameLabel = styled(Text)`
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
`;

const EvidenceHeading = styled(FrameLabel)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const TransactionLabel = styled(Flex)`
  min-width: 0;
  flex: 1;
`;

const TransactionNameText = styled(Text)`
  min-width: 0;
  flex: 1;
`;

const InlineLabel = styled(Text)`
  flex-shrink: 0;
  font-weight: ${p => p.theme.font.weight.normal};
  margin-right: ${p => p.theme.space.xs};
`;

const MetadataBadge = styled('div')`
  flex-shrink: 0;
  color: ${p => p.theme.tokens.content.muted};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.normal};
  line-height: 1;
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.primary};
`;

const EvidencePanel = styled('div')`
  padding: ${p => p.theme.space.sm};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const QueryList = styled('div')`
  > * + * {
    margin-top: ${p => p.theme.space.sm};
    padding-top: ${p => p.theme.space.sm};
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const QueryShape = styled('div')`
  min-width: 0;
`;

const SpanDetails = styled('div')`
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: ${p => p.theme.font.size.sm};

  & + & {
    margin-top: ${p => p.theme.space.xs};
  }
`;

const StyledCodeBlock = styled(CodeBlock)`
  min-width: 0;

  > div:last-child {
    overflow-x: hidden;
  }

  pre {
    margin: 0 !important;
    padding: ${p => p.theme.space.sm} !important;
    width: 100% !important;
    min-width: 0 !important;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  pre,
  code {
    line-height: 18px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;
