import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
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
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getDynamicText from 'sentry/utils/getDynamicText';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {
  Frame,
  SpanDescription,
} from 'sentry/views/insights/common/components/spanDescription';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {FrameContainer} from 'sentry/views/insights/database/components/stackTraceMiniFrame';
import {ModuleName} from 'sentry/views/insights/types';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {isTransactionNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {GeneralSpanDetailsValue} from 'sentry/views/performance/traceDetails/newTraceDetailsValueRenderer';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

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
  event: Readonly<EventTransaction>;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  openPanel: string | undefined;
  organization: Organization;
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
    props.node.value.sentry_tags?.op,
    props.node.value.sentry_tags?.category
  );

  const childTransactions = useMemo(() => {
    const transactions: TraceTreeNode<TraceTree.Transaction>[] = [];
    TraceTree.ForEachChild(props.node, c => {
      if (isTransactionNode(c)) {
        transactions.push(c);
      }
    });
    return transactions;
  }, [props.node]);

  function renderTraversalButton(): React.ReactNode {
    if (!childTransactions) {
      // TODO: Amend size to use theme when we eventually refactor LoadingIndicator
      // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
      return (
        <StyledDiscoverButton href="#" size="xs" disabled>
          <StyledLoadingIndicator size={12} />
        </StyledDiscoverButton>
      );
    }

    if (childTransactions.length <= 0) {
      return null;
    }

    const {trace, event, organization} = props;

    if (childTransactions.length === 1) {
      // Note: This is rendered by renderSpanChild() as a dedicated row
      return null;
    }

    const {start, end} = getTraceDateTimeRange({
      start: trace.traceStartTimestamp,
      end: trace.traceEndTimestamp,
    });

    const childrenEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Children from Span ID ${props.node.value.span_id}`,
      fields: [
        'transaction',
        'project',
        'trace.span',
        'transaction.duration',
        'timestamp',
      ],
      orderby: '-timestamp',
      query: `event.type:transaction trace:${props.node.value.trace_id} trace.parent_span:${props.node.value.span_id}`,
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
        to={childrenEventView.getResultsViewUrlTarget(
          organization.slug,
          false,
          hasDatasetSelector(organization) ? SavedQueryDatasets.TRANSACTIONS : undefined
        )}
      >
        {t('View Children')}
      </StyledDiscoverButton>
    );
  }

  function renderSpanChild(): React.ReactNode {
    const childTransaction = childTransactions[0];

    if (!childTransaction) {
      return null;
    }

    const transactionResult: TransactionResult = {
      'project.name': childTransaction.value.project_slug,
      transaction: childTransaction.value.transaction,
      'trace.span': childTransaction.value.span_id,
      id: childTransaction.value.event_id,
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
            orgSlug: props.organization.slug,
            transaction: transactionResult.transaction,
            query: omit(location.query, Object.values(PAGE_URL_PARAM)),
            projectID: String(childTransaction.value.project_id),
          });

          return (
            <ButtonGroup>
              <LinkButton data-test-id="view-child-transaction" size="xs" to={to}>
                {t('View Transaction')}
              </LinkButton>
              <LinkButton size="xs" to={target}>
                {t('View Summary')}
              </LinkButton>
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
    const {organization, event} = props;

    if (isGapSpan(props.node.value) || !props.node.value.op || !props.node.value.hash) {
      return null;
    }

    const transactionName = event.title;
    const hasNewSpansUIFlag =
      organization.features.includes('performance-spans-new-ui') &&
      organization.features.includes('insights-initial-modules');

    // The new spans UI relies on the group hash assigned by Relay, which is different from the hash available on the span itself
    const groupHash = hasNewSpansUIFlag
      ? props.node.value.sentry_tags?.group ?? ''
      : props.node.value.hash;

    // Do not render a button if there is no group hash, since this can result in broken links
    if (hasNewSpansUIFlag && !groupHash) {
      return null;
    }

    return (
      <ButtonGroup>
        <SpanSummaryButton
          event={event}
          organization={organization}
          span={props.node.value}
        />
        <LinkButton
          size="xs"
          to={spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionName,
            query: location.query,
            spanSlug: {op: props.node.value.op, group: groupHash},
            projectID: event.projectID,
          })}
        >
          {hasNewSpansUIFlag ? t('More Samples') : t('View Similar Spans')}
        </LinkButton>
      </ButtonGroup>
    );
  }

  function renderOrphanSpanMessage() {
    if (!isOrphanSpan(props.node.value)) {
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
    const hasErrors =
      props.node.errors.size > 0 || props.node.performance_issues.size > 0;

    if (!hasErrors || isGapSpan(props.node.value)) {
      return null;
    }

    return (
      <IssueList organization={props.organization} issues={issues} node={props.node} />
    );
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
    if (
      !props.organization.features.includes('profiling') ||
      isGapSpan(props.node.value)
    ) {
      return null;
    }

    return <SpanProfileDetails span={props.node.value} event={props.event} />;
  }

  function renderSpanDetails() {
    const {event, organization} = props;
    const span = props.node.value;

    if (isGapSpan(span)) {
      return (
        <SpanDetails>
          {organization.features.includes('profiling') ? (
            <GapSpanDetails event={event} span={span} />
          ) : (
            <InlineDocs platform={event.sdk?.name || ''} />
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
    const parentTransaction = TraceTree.ParentTransaction(props.node);
    const averageSpanSelfTime: number | undefined =
      span['span.averageResults']?.['avg(span.self_time)'];
    const averageSpanDuration: number | undefined =
      span['span.averageResults']?.['avg(span.duration)'];

    return (
      <Fragment>
        {renderOrphanSpanMessage()}
        {renderSpanErrorMessage()}
        {renderProfileMessage()}
        <SpanDetails>
          <table className="table key-value">
            <tbody>
              <Row title={t('Duration')}>
                <TraceDrawerComponents.Duration
                  duration={duration}
                  baseline={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
                  baseDescription={t(
                    'Average total time for this span group across the project associated with its parent transaction, over the last 24 hours'
                  )}
                  node={props.node}
                />
              </Row>
              {span.exclusive_time ? (
                <Row
                  title={t('Self Time')}
                  toolTipText={t(
                    'The time spent exclusively in this span, excluding the total duration of its children'
                  )}
                >
                  <TraceDrawerComponents.Duration
                    ratio={span.exclusive_time / 1000 / duration}
                    duration={span.exclusive_time / 1000}
                    baseline={
                      averageSpanSelfTime ? averageSpanSelfTime / 1000 : undefined
                    }
                    baseDescription={t(
                      'Average self time for this span group across the project associated with its parent transaction, over the last 24 hours'
                    )}
                    node={props.node}
                  />
                </Row>
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
              <SpanHTTPInfo span={span} />
              <Row
                title={
                  resolvedModule === ModuleName.DB && span.op?.startsWith('db')
                    ? t('Database Query')
                    : t('Description')
                }
                extra={renderSpanDetailActions()}
              >
                {resolvedModule === ModuleName.DB ? (
                  <SpanDescriptionWrapper>
                    <SpanDescription
                      groupId={span.sentry_tags?.group ?? ''}
                      op={span.op ?? ''}
                      preliminaryDescription={span.description}
                    />
                  </SpanDescriptionWrapper>
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
                    {value >= 1024 && <span>{` (${value} B)`}</span>}
                  </Fragment>
                </Row>
              ))}
              {Object.entries(nonSizeKeys).map(([key, value]) =>
                !isHiddenDataKey(key) ? (
                  <Row title={key} key={key}>
                    <GeneralSpanDetailsValue value={value} />
                  </Row>
                ) : null
              )}
              {unknownKeys.map(key => {
                if (key === 'event' || key === 'childTransactions') {
                  // dont render the entire JSON payload
                  return null;
                }
                return (
                  <Row title={key} key={key}>
                    <GeneralSpanDetailsValue value={span[key]} />
                  </Row>
                );
              })}
            </tbody>
          </table>
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

const StyledDiscoverButton = styled(DiscoverButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

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
  margin: ${space(2)} 0;
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
export const ButtonGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

export const ValueRow = styled('div')`
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

export const ButtonContainer = styled('div')`
  padding: 8px 10px;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

const SpanDescriptionWrapper = styled('div')`
  ${Frame} {
    border: none;
  }

  ${FrameContainer} {
    padding: ${space(2)} 0 0 0;
    margin-top: ${space(2)};
  }

  pre {
    padding: 0 !important;
  }
`;

export default NewTraceDetailsSpanDetail;
