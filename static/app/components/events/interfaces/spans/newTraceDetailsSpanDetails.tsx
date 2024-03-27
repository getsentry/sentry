import {Fragment, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DateTime from 'sentry/components/dateTime';
import DiscoverButton from 'sentry/components/discoverButton';
import SpanSummaryButton from 'sentry/components/events/interfaces/spans/spanSummaryButton';
import FileSize from 'sentry/components/fileSize';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {ALL_ACCESS_PROJECTS, PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type {EventTransaction} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {CustomMetricsEventData} from 'sentry/views/ddm/customMetricsEventData';
import DurationComparison from 'sentry/views/performance/newTraceDetails/traceDrawer/details/durationComparison';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceTabs';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {ModuleName} from 'sentry/views/starfish/types';
import {resolveSpanModule} from 'sentry/views/starfish/utils/resolveSpanModule';

import {OpsDot} from '../../opsBreakdown';

import * as SpanEntryContext from './context';
import {GapSpanDetails} from './gapSpanDetails';
import InlineDocs from './inlineDocs';
import {SpanProfileDetails} from './spanProfileDetails';
import type {ParsedTraceType, RawSpanType} from './types';
import {rawSpanKeys} from './types';
import type {SubTimingInfo} from './utils';
import {
  getFormattedTimeRangeWithLeadingAndTrailingZero,
  getSpanSubTimings,
  getTraceDateTimeRange,
  isGapSpan,
  isHiddenDataKey,
  isOrphanSpan,
  scrollToSpan,
} from './utils';

const SIZE_DATA_KEYS = [
  'Encoded Body Size',
  'Decoded Body Size',
  'Transfer Size',
  'http.request_content_length',
  'http.response_content_length',
  'http.decoded_response_content_length',
  'http.response_transfer_size',
];

type TransactionResult = {
  id: string;
  'project.name': string;
  'trace.span': string;
  transaction: string;
};

export type SpanDetailProps = {
  childTransactions: TraceFullDetailed[] | null;
  event: Readonly<EventTransaction>;
  node: TraceTreeNode<TraceTree.NodeValue>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  openPanel: string | undefined;
  organization: Organization;
  span: RawSpanType;
  trace: Readonly<ParsedTraceType>;
};

function NewTraceDetailsSpanDetail(props: SpanDetailProps) {
  const location = useLocation();
  const profileId = props.event.contexts.profile?.profile_id || '';
  const issues = useMemo(() => {
    return [...props.node.errors, ...props.node.performance_issues];
  }, [props.node.errors, props.node.performance_issues]);
  const {projects} = useProjects();
  const project = projects.find(p => p.id === props.event.projectID);
  const resolvedModule: ModuleName = resolveSpanModule(
    props.span.sentry_tags?.op,
    props.span.sentry_tags?.category
  );

  useLayoutEffect(() => {
    if (!('op' in props.span)) {
      return;
    }
  }, [props.span]);

  function renderTraversalButton(): React.ReactNode {
    if (!props.childTransactions) {
      // TODO: Amend size to use theme when we eventually refactor LoadingIndicator
      // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
      return (
        <StyledDiscoverButton size="xs" disabled>
          <StyledLoadingIndicator size={12} />
        </StyledDiscoverButton>
      );
    }

    if (props.childTransactions.length <= 0) {
      return null;
    }

    const {span, trace, event, organization} = props;

    assert(!isGapSpan(span));

    if (props.childTransactions.length === 1) {
      // Note: This is rendered by renderSpanChild() as a dedicated row
      return null;
    }

    const {start, end} = getTraceDateTimeRange({
      start: trace.traceStartTimestamp,
      end: trace.traceEndTimestamp,
    });

    const childrenEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Children from Span ID ${span.span_id}`,
      fields: [
        'transaction',
        'project',
        'trace.span',
        'transaction.duration',
        'timestamp',
      ],
      orderby: '-timestamp',
      query: `event.type:transaction trace:${span.trace_id} trace.parent_span:${span.span_id}`,
      projects: organization.features.includes('global-views')
        ? [ALL_ACCESS_PROJECTS]
        : [Number(event.projectID)],
      version: 2,
      start,
      end,
    });

    return (
      <StyledDiscoverButton
        data-test-id="view-child-transactions"
        size="xs"
        to={childrenEventView.getResultsViewUrlTarget(organization.slug)}
      >
        {t('View Children')}
      </StyledDiscoverButton>
    );
  }

  function renderSpanChild(): React.ReactNode {
    const {childTransactions, organization} = props;

    if (!childTransactions || childTransactions.length !== 1) {
      return null;
    }

    const childTransaction = childTransactions[0];

    const transactionResult: TransactionResult = {
      'project.name': childTransaction.project_slug,
      transaction: childTransaction.transaction,
      'trace.span': childTransaction.span_id,
      id: childTransaction.event_id,
    };

    const eventSlug = generateSlug(transactionResult);

    const viewChildButton = (
      <SpanEntryContext.Consumer>
        {({getViewChildTransactionTarget}) => {
          const to = getViewChildTransactionTarget({
            ...transactionResult,
            eventSlug,
          });

          if (!to) {
            return null;
          }

          const target = transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionResult.transaction,
            query: omit(location.query, Object.values(PAGE_URL_PARAM)),
            projectID: String(childTransaction.project_id),
          });

          return (
            <ButtonGroup>
              <StyledButton data-test-id="view-child-transaction" size="xs" to={to}>
                {t('View Transaction')}
              </StyledButton>
              <StyledButton size="xs" to={target}>
                {t('View Summary')}
              </StyledButton>
            </ButtonGroup>
          );
        }}
      </SpanEntryContext.Consumer>
    );

    return (
      <Row title={t('Child Transaction')} extra={viewChildButton}>
        {`${transactionResult.transaction} (${transactionResult['project.name']})`}
      </Row>
    );
  }

  function renderSpanDetailActions() {
    const {span, organization, event} = props;

    if (isGapSpan(span) || !span.op || !span.hash) {
      return null;
    }

    const transactionName = event.title;

    return (
      <ButtonGroup>
        <SpanSummaryButton event={event} organization={organization} span={span} />
        <StyledButton
          size="xs"
          to={spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionName,
            query: location.query,
            spanSlug: {op: span.op, group: span.hash},
            projectID: event.projectID,
          })}
        >
          {t('View Similar Spans')}
        </StyledButton>
      </ButtonGroup>
    );
  }

  function renderOrphanSpanMessage() {
    const {span} = props;

    if (!isOrphanSpan(span)) {
      return null;
    }

    return (
      <Alert type="info" showIcon system>
        {t(
          'This is a span that has no parent span within this transaction. It has been attached to the transaction root span by default.'
        )}
      </Alert>
    );
  }

  function renderSpanErrorMessage() {
    const {span, organization, node} = props;

    const hasErrors = node.errors.length > 0 || node.performance_issues.length > 0;

    if (!hasErrors || isGapSpan(span)) {
      return null;
    }

    return <IssueList organization={organization} issues={issues} node={props.node} />;
  }

  function partitionSizes(data): {
    nonSizeKeys: {[key: string]: unknown};
    sizeKeys: {[key: string]: number};
  } {
    const sizeKeys = SIZE_DATA_KEYS.reduce((keys, key) => {
      if (data.hasOwnProperty(key) && defined(data[key])) {
        try {
          keys[key] = parseInt(data[key], 10);
        } catch (e) {
          keys[key] = data[key];
        }
      }
      return keys;
    }, {});

    const nonSizeKeys = {...data};
    SIZE_DATA_KEYS.forEach(key => delete nonSizeKeys[key]);

    return {
      sizeKeys,
      nonSizeKeys,
    };
  }

  function renderProfileMessage() {
    const {organization, span, event} = props;

    if (!organization.features.includes('profiling') || isGapSpan(span)) {
      return null;
    }

    return <SpanProfileDetails span={span} event={event} />;
  }

  function renderSpanDetails() {
    const {span, event, organization} = props;

    if (isGapSpan(span)) {
      return (
        <SpanDetails>
          {organization.features.includes('profiling') ? (
            <GapSpanDetails event={event} span={span} resetCellMeasureCache={() => {}} />
          ) : (
            <InlineDocs
              orgSlug={organization.slug}
              platform={event.sdk?.name || ''}
              projectSlug={event?.projectSlug ?? ''}
              resetCellMeasureCache={() => {}}
            />
          )}
        </SpanDetails>
      );
    }

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;
    const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
      getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);

    const duration = endTimestamp - startTimestamp;

    const unknownKeys = Object.keys(span).filter(key => {
      return !isHiddenDataKey(key) && !rawSpanKeys.has(key as any);
    });

    const {sizeKeys, nonSizeKeys} = partitionSizes(span?.data ?? {});

    const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
      value => value === 0
    );

    const timingKeys = getSpanSubTimings(span) ?? [];
    const parentTransaction = props.node.parent_transaction;
    const averageSpanSelfTimeInMs: number | undefined = span['span.average_time']
      ? span['span.average_time'] / 1000
      : undefined;

    return (
      <Fragment>
        {renderOrphanSpanMessage()}
        {renderSpanErrorMessage()}
        {renderProfileMessage()}
        <SpanDetails>
          <table className="table key-value">
            <tbody>
              <DurationComparison
                title={t('Duration')}
                duration={duration}
                avgDuration={averageSpanSelfTimeInMs}
              />
              {span.exclusive_time ? (
                <DurationComparison
                  toolTipText={t(
                    'The time spent exclusively in this span, excluding the total duration of its children'
                  )}
                  title={t('Self Time')}
                  duration={span.exclusive_time / 1000}
                  avgDuration={averageSpanSelfTimeInMs}
                />
              ) : null}
              {parentTransaction ? (
                <Row title="Parent Transaction">
                  <td className="value">
                    <a href="#" onClick={() => props.onParentClick(parentTransaction)}>
                      {getTraceTabTitle(parentTransaction)}
                    </a>
                  </td>
                </Row>
              ) : null}
              <Row
                title={
                  isGapSpan(span) ? (
                    <SpanIdTitle>Span ID</SpanIdTitle>
                  ) : (
                    <SpanIdTitle
                      onClick={scrollToSpan(
                        span.span_id,
                        () => {},
                        location,
                        organization
                      )}
                    >
                      Span ID
                    </SpanIdTitle>
                  )
                }
                extra={renderTraversalButton()}
              >
                {span.span_id}
                <CopyToClipboardButton
                  borderless
                  size="zero"
                  iconSize="xs"
                  text={span.span_id}
                />
              </Row>
              {profileId && project?.slug && (
                <Row
                  title="Profile ID"
                  extra={
                    <TransactionToProfileButton
                      size="xs"
                      projectSlug={project.slug}
                      event={event}
                      query={{
                        spanId: span.span_id,
                      }}
                    >
                      {t('View Profile')}
                    </TransactionToProfileButton>
                  }
                >
                  {profileId}
                </Row>
              )}
              <Row title={t('Status')}>{span.status || ''}</Row>
              <SpanHTTPInfo span={props.span} />
              <Row
                title={
                  resolvedModule === ModuleName.DB && span.op?.startsWith('db')
                    ? t('Database Query')
                    : t('Description')
                }
                extra={renderSpanDetailActions()}
              >
                {resolvedModule === ModuleName.DB ? (
                  <SpanDescription
                    groupId={span.sentry_tags?.group ?? ''}
                    op={span.op ?? ''}
                    preliminaryDescription={span.description}
                  />
                ) : (
                  span.description
                )}
              </Row>
              <Row title={t('Date Range')}>
                {getDynamicText({
                  fixed: 'Mar 16, 2020 9:10:12 AM UTC',
                  value: (
                    <Fragment>
                      <DateTime date={startTimestamp * 1000} year seconds timeZone />
                      {` (${startTimeWithLeadingZero})`}
                    </Fragment>
                  ),
                })}
                <br />
                {getDynamicText({
                  fixed: 'Mar 16, 2020 9:10:13 AM UTC',
                  value: (
                    <Fragment>
                      <DateTime date={endTimestamp * 1000} year seconds timeZone />
                      {` (${endTimeWithLeadingZero})`}
                    </Fragment>
                  ),
                })}
              </Row>
              <Row title={t('Origin')}>
                {span.origin !== undefined ? String(span.origin) : null}
              </Row>
              <Row title="Parent Span ID">{span.parent_span_id || ''}</Row>
              {renderSpanChild()}
              <Row title={t('Same Process as Parent')}>
                {span.same_process_as_parent !== undefined
                  ? String(span.same_process_as_parent)
                  : null}
              </Row>
              <Row title={t('Span Group')}>
                {defined(span.hash) ? String(span.hash) : null}
              </Row>
              {timingKeys.map(timing => (
                <Row
                  title={timing.name}
                  key={timing.name}
                  prefix={<RowTimingPrefix timing={timing} />}
                >
                  {getPerformanceDuration(Number(timing.duration) * 1000)}
                </Row>
              ))}
              <Tags span={span} />
              {allZeroSizes && (
                <TextTr>
                  The following sizes were not collected for security reasons. Check if
                  the host serves the appropriate
                  <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin">
                    <span className="val-string">Timing-Allow-Origin</span>
                  </ExternalLink>
                  header. You may have to enable this collection manually.
                </TextTr>
              )}
              {Object.entries(sizeKeys).map(([key, value]) => (
                <Row title={key} key={key}>
                  <Fragment>
                    <FileSize bytes={value} />
                    {value >= 1024 && <span>{` (${maybeStringify(value)} B)`}</span>}
                  </Fragment>
                </Row>
              ))}
              {Object.entries(nonSizeKeys).map(([key, value]) =>
                !isHiddenDataKey(key) ? (
                  <Row title={key} key={key}>
                    {maybeStringify(value)}
                  </Row>
                ) : null
              )}
              {unknownKeys.map(key => (
                <Row title={key} key={key}>
                  {maybeStringify(span[key])}
                </Row>
              ))}
            </tbody>
          </table>
          {span._metrics_summary ? (
            <CustomMetricsEventData
              metricsSummary={span._metrics_summary}
              startTimestamp={span.start_timestamp}
            />
          ) : null}
        </SpanDetails>
      </Fragment>
    );
  }

  return (
    <SpanDetailContainer
      data-component="span-detail"
      onClick={event => {
        // prevent toggling the span detail
        event.stopPropagation();
      }}
    >
      {renderSpanDetails()}
    </SpanDetailContainer>
  );
}

function SpanHTTPInfo({span}: {span: RawSpanType}) {
  if (span.op === 'http.client' && span.description) {
    const [method, url] = span.description.split(' ');

    const parsedURL = safeURL(url);
    const queryString = qs.parse(parsedURL?.search ?? '');

    return parsedURL ? (
      <Fragment>
        <Row title={t('HTTP Method')}>{method}</Row>
        <Row title={t('URL')}>
          {parsedURL ? parsedURL?.origin + parsedURL?.pathname : 'failed to parse URL'}
        </Row>
        <Row title={t('Query')}>
          {parsedURL
            ? JSON.stringify(queryString, null, 2)
            : 'failed to parse query string'}
        </Row>
      </Fragment>
    ) : null;
  }

  return null;
}

function RowTimingPrefix({timing}: {timing: SubTimingInfo}) {
  return <OpsDot style={{backgroundColor: timing.color}} />;
}

function maybeStringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 4);
}

const StyledDiscoverButton = styled(DiscoverButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const StyledButton = styled(Button)``;

export const SpanDetailContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  cursor: auto;
`;

export const SpanDetails = styled('div')`
  table.table.key-value td.key {
    max-width: 280px;
  }

  pre {
    overflow: hidden !important;
  }
`;

const ValueTd = styled('td')`
  position: relative;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  height: ${space(2)};
  margin: 0;
`;

const StyledText = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(2)} ${space(0)};
`;

function TextTr({children}) {
  return (
    <tr>
      <td className="key" />
      <ValueTd className="value">
        <StyledText>{children}</StyledText>
      </ValueTd>
    </tr>
  );
}

const SpanIdTitle = styled('a')`
  display: flex;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

export function Row({
  title,
  keep,
  children,
  prefix,
  extra = null,
  toolTipText,
}: {
  children: React.ReactNode;
  title: JSX.Element | string | null;
  extra?: React.ReactNode;
  keep?: boolean;
  prefix?: JSX.Element;
  toolTipText?: string;
}) {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">
        <Flex>
          {prefix}
          {title}
          {toolTipText ? <StyledQuestionTooltip size="xs" title={toolTipText} /> : null}
        </Flex>
      </td>
      <ValueTd className="value">
        <ValueRow>
          <StyledPre>
            <span className="val-string">{children}</span>
          </StyledPre>
          <ButtonContainer>{extra}</ButtonContainer>
        </ValueRow>
      </ValueTd>
    </tr>
  );
}

export function Tags({span}: {span: RawSpanType}) {
  const tags: {[tag_name: string]: string} | undefined = span?.tags;

  if (!tags) {
    return null;
  }

  const keys = Object.keys(tags);

  if (keys.length <= 0) {
    return null;
  }

  return (
    <tr>
      <td className="key">Tags</td>
      <td className="value">
        <Pills style={{padding: '8px'}}>
          {keys.map((key, index) => (
            <Pill key={index} name={key} value={String(tags[key]) || ''} />
          ))}
        </Pills>
      </td>
    </tr>
  );
}

function generateSlug(result: TransactionResult): string {
  return generateEventSlug({
    id: result.id,
    'project.name': result['project.name'],
  });
}

const Flex = styled('div')`
  display: flex;
  align-items: center;
`;
const ButtonGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const ValueRow = styled('div')`
  display: grid;
  grid-template-columns: auto min-content;
  gap: ${space(1)};

  border-radius: 4px;
  background-color: ${p => p.theme.surface200};
  margin: 2px;
`;

const StyledPre = styled('pre')`
  margin: 0 !important;
  background-color: transparent !important;
`;

const ButtonContainer = styled('div')`
  padding: 8px 10px;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

export default NewTraceDetailsSpanDetail;
