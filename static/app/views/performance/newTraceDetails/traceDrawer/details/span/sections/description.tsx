import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import SpanSummaryButton from 'sentry/components/events/interfaces/spans/spanSummaryButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
import {ModuleName} from 'sentry/views/insights/types';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

import {TraceDrawerComponents} from '../../styles';

const formatter = new SQLishFormatter();

export function hasFormattedSpanDescription(node: TraceTreeNode<TraceTree.Span>) {
  const span = node.value;
  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  const formattedDescription =
    resolvedModule !== ModuleName.DB
      ? span.description ?? ''
      : formatter.toString(span.description ?? '');

  return (
    !!formattedDescription &&
    [ModuleName.DB, ModuleName.RESOURCE].includes(resolvedModule)
  );
}

export function SpanDescription({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const span = node.value;
  const {event} = span;
  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  const formattedDescription = useMemo(() => {
    if (resolvedModule !== ModuleName.DB) {
      return span.description ?? '';
    }

    return formatter.toString(span.description ?? '');
  }, [span.description, resolvedModule]);

  if (!hasFormattedSpanDescription(node)) {
    return null;
  }

  const hasNewSpansUIFlag =
    organization.features.includes('performance-spans-new-ui') &&
    organization.features.includes('insights-initial-modules');

  // The new spans UI relies on the group hash assigned by Relay, which is different from the hash available on the span itself
  const groupHash = hasNewSpansUIFlag ? span.sentry_tags?.group ?? '' : span.hash ?? '';

  const actions =
    !span.op || !span.hash ? null : (
      <ButtonGroup>
        <SpanSummaryButton event={event} organization={organization} span={span} />
        <LinkButton
          size="xs"
          to={spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: event.title,
            query: location.query,
            spanSlug: {op: span.op, group: groupHash},
            projectID: event.projectID,
          })}
          onClick={() => {
            hasNewSpansUIFlag
              ? trackAnalytics('trace.trace_layout.view_span_summary', {
                  organization,
                  module: resolvedModule,
                })
              : trackAnalytics('trace.trace_layout.view_similar_spans', {
                  organization,
                  module: resolvedModule,
                  source: 'span_description',
                });
          }}
        >
          {hasNewSpansUIFlag ? t('View Span Summary') : t('View Similar Spans')}
        </LinkButton>
      </ButtonGroup>
    );

  const value =
    resolvedModule === ModuleName.DB ? (
      <Fragment>
        <CodeSnippet language="sql" isRounded={false}>
          {formattedDescription}
        </CodeSnippet>
        {span?.data?.['code.filepath'] ? (
          <StackTraceMiniFrame
            projectId={span.event.projectID}
            eventId={span.event.eventID}
            frame={{
              filename: span?.data?.['code.filepath'],
              lineNo: span?.data?.['code.lineno'],
              function: span?.data?.['code.function'],
            }}
          />
        ) : (
          <MissingFrame />
        )}
      </Fragment>
    ) : (
      formattedDescription
    );

  const title =
    resolvedModule === ModuleName.DB && span.op?.startsWith('db')
      ? t('Database Query')
      : t('Resource');

  return (
    <TraceDrawerComponents.SectionCard
      items={[
        {
          key: 'description',
          subject: t('Description'),
          subjectNode: null,
          value,
        },
      ]}
      title={
        <TitleContainer>
          {title}
          {actions}
        </TitleContainer>
      }
    />
  );
}

const TitleContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.5)};
  justify-content: space-between;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  flex-wrap: wrap;
  justify-content: flex-end;
`;
