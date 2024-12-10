import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import SpanSummaryButton from 'sentry/components/events/interfaces/spans/spanSummaryButton';
import Link from 'sentry/components/links/link';
import LinkHint from 'sentry/components/structuredEventData/linkHint';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {
  MissingFrame,
  StackTraceMiniFrame,
} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {
  isValidJson,
  prettyPrintJsonString,
} from 'sentry/views/insights/database/utils/jsonUtils';
import {ModuleName} from 'sentry/views/insights/types';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

import type {TraceTree} from '../../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../../traceModels/traceTreeNode';
import {TraceDrawerComponents} from '../../styles';
import SpanSummaryLink from '../components/spanSummaryLink';

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
  project,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
  project: Project | undefined;
}) {
  const hasTraceNewUi = useHasTraceNewUi();
  const span = node.value;

  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  const system = span?.data?.['db.system'];
  const formattedDescription = useMemo(() => {
    if (resolvedModule !== ModuleName.DB) {
      return span.description ?? '';
    }

    if (
      system === SupportedDatabaseSystem.MONGODB &&
      span?.sentry_tags?.description &&
      isValidJson(span.sentry_tags.description)
    ) {
      return prettyPrintJsonString(span.sentry_tags.description).prettifiedQuery;
    }

    return formatter.toString(span.description ?? '');
  }, [span.description, resolvedModule, span.sentry_tags?.description, system]);

  if (!hasTraceNewUi) {
    return (
      <LegacySpanDescription
        node={node}
        organization={organization}
        location={location}
      />
    );
  }

  const hasNewSpansUIFlag =
    organization.features.includes('performance-spans-new-ui') &&
    organization.features.includes('insights-initial-modules');

  // The new spans UI relies on the group hash assigned by Relay, which is different from the hash available on the span itself
  const groupHash = hasNewSpansUIFlag ? span.sentry_tags?.group ?? '' : span.hash ?? '';
  const averageSpanDuration: number | undefined =
    span['span.averageResults']?.['avg(span.duration)'];

  const actions =
    !span.op || !span.hash ? null : (
      <BodyContentWrapper
        padding={
          resolvedModule === ModuleName.DB ? `${space(1)} ${space(2)}` : `${space(1)}`
        }
      >
        <SpanSummaryLink event={node.event!} organization={organization} span={span} />
        <Link
          to={spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: node.event?.title ?? '',
            query: location.query,
            spanSlug: {op: span.op, group: groupHash},
            projectID: node.event?.projectID,
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
          <StyledIconGraph type="area" size="xs" />
          {hasNewSpansUIFlag ? t('View Span Summary') : t('View Similar Spans')}
        </Link>
      </BodyContentWrapper>
    );

  const value =
    resolvedModule === ModuleName.DB ? (
      <CodeSnippetWrapper>
        <StyledCodeSnippet
          language={system === 'mongodb' ? 'json' : 'sql'}
          isRounded={false}
        >
          {formattedDescription}
        </StyledCodeSnippet>
        {span?.data?.['code.filepath'] ? (
          <StackTraceMiniFrame
            projectId={node.event?.projectID}
            eventId={node.event?.eventID}
            frame={{
              filename: span?.data?.['code.filepath'],
              lineNo: span?.data?.['code.lineno'],
              function: span?.data?.['code.function'],
            }}
          />
        ) : (
          <MissingFrame />
        )}
      </CodeSnippetWrapper>
    ) : (
      <DescriptionWrapper>
        {formattedDescription ? (
          <Fragment>
            <span>
              {formattedDescription}
              <LinkHint value={formattedDescription} />
            </span>
            <CopyToClipboardButton
              borderless
              size="zero"
              iconSize="xs"
              text={formattedDescription}
              tooltipProps={{disabled: true}}
            />
          </Fragment>
        ) : (
          t('This span has no description')
        )}
      </DescriptionWrapper>
    );

  return (
    <TraceDrawerComponents.Highlights
      node={node}
      transaction={undefined}
      project={project}
      avgDuration={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
      headerContent={value}
      bodyContent={actions}
    />
  );
}

const CodeSnippetWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const StyledIconGraph = styled(IconGraph)`
  margin-right: ${space(0.5)};
`;

function LegacySpanDescription({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const span = node.value;

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
        <SpanSummaryButton event={node.event!} organization={organization} span={span} />
        <LinkButton
          size="xs"
          to={spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: node.event?.title ?? '',
            query: location.query,
            spanSlug: {op: span.op, group: groupHash},
            projectID: node.event?.projectID,
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
        <StyledCodeSnippet language="sql" isRounded={false}>
          {formattedDescription}
        </StyledCodeSnippet>
        {span?.data?.['code.filepath'] ? (
          <StackTraceMiniFrame
            projectId={node.event?.projectID}
            eventId={node.event?.eventID}
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
      : t('Asset');

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

const BodyContentWrapper = styled('div')<{padding: string}>`
  display: flex;
  gap: ${space(1)};
  padding: ${p => p.padding};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  code {
    text-wrap: wrap;
  }
`;

const DescriptionWrapper = styled('div')`
  display: flex;
  align-items: baseline;
  font-size: ${p => p.theme.fontSizeMedium};
  width: 100%;
  justify-content: space-between;
  flex-direction: row;
  gap: ${space(0.5)};
  word-break: break-word;
  padding: ${space(1)};
`;
