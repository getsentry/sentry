import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import DiscoverButton from 'sentry/components/discoverButton';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import SpanSummaryButton from 'sentry/components/events/interfaces/spans/spanSummaryButton';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {rawSpanKeys} from 'sentry/components/events/interfaces/spans/types';
import type {SubTimingInfo} from 'sentry/components/events/interfaces/spans/utils';
import {
  getFormattedTimeRangeWithLeadingAndTrailingZero,
  getSpanSubTimings,
  getTraceDateTimeRange,
  isGapSpan,
  isHiddenDataKey,
  scrollToSpan,
} from 'sentry/components/events/interfaces/spans/utils';
import {OpsDot} from 'sentry/components/events/opsBreakdown';
import FileSize from 'sentry/components/fileSize';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import {ALL_ACCESS_PROJECTS, PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import type {Organization} from 'sentry/types/organization';
import {assert} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getDynamicText from 'sentry/utils/getDynamicText';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {GeneralSpanDetailsValue} from 'sentry/views/performance/traceDetails/newTraceDetailsValueRenderer';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';
import {
  Frame,
  SpanDescription as DBQueryDescription,
} from 'sentry/views/starfish/components/spanDescription';
import {FrameContainer} from 'sentry/views/starfish/components/stackTraceMiniFrame';
import {ModuleName} from 'sentry/views/starfish/types';
import {resolveSpanModule} from 'sentry/views/starfish/utils/resolveSpanModule';

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

type SpanDetailProps = {
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  openPanel: string | undefined;
  organization: Organization;
};

function SpanNodeDetailTable(props: SpanDetailProps) {
  const location = useLocation();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === props.node.value.event.projectID);
  const {organization} = props;
  const span = props.node.value;

  return (
    <SpanDetailContainer
      data-component="span-detail"
      onClick={event => {
        // prevent toggling the span detail
        event.stopPropagation();
      }}
    >
      <Fragment>
        <SpanDetails>
          <table className="table key-value">
            <tbody>
              <ProfileLink node={props.node} project={project} />
              <SpanDescription
                node={props.node}
                organization={organization}
                location={location}
              />
              <DurationSummary node={props.node} />
              <SpanHTTPInfo span={span} />
              <AncestryAndGrouping
                node={props.node}
                organization={organization}
                location={location}
                onParentClick={props.onParentClick}
              />
              <Tags span={span} />
              <SpanKeys node={props.node} />
            </tbody>
          </table>
        </SpanDetails>
      </Fragment>
    </SpanDetailContainer>
  );
}

function ProfileLink({
  node,
  project,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  project: Project | undefined;
}) {
  const {event} = node.value;
  const profileId = event.contexts.profile?.profile_id || '';
  return profileId && project?.slug ? (
    <TraceDrawerComponents.TableRow
      title="Profile ID"
      extra={
        <TransactionToProfileButton
          size="xs"
          projectSlug={project.slug}
          event={event}
          query={{
            spanId: node.value.span_id,
          }}
        >
          {t('View Profile')}
        </TransactionToProfileButton>
      }
    >
      {profileId}
    </TraceDrawerComponents.TableRow>
  ) : null;
}

function SpanDescription({
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

  return (
    <TraceDrawerComponents.TableRow
      title={
        resolvedModule === ModuleName.DB && span.op?.startsWith('db')
          ? t('Database Query')
          : t('Description')
      }
      extra={
        !span.op || !span.hash ? null : (
          <ButtonGroup>
            <SpanSummaryButton event={event} organization={organization} span={span} />
            <StyledButton
              size="xs"
              to={spanDetailsRouteWithQuery({
                orgSlug: organization.slug,
                transaction: event.title,
                query: location.query,
                spanSlug: {op: span.op, group: span.hash},
                projectID: event.projectID,
              })}
            >
              {t('View Similar Spans')}
            </StyledButton>
          </ButtonGroup>
        )
      }
    >
      {resolvedModule === ModuleName.DB ? (
        <SpanDescriptionWrapper>
          <DBQueryDescription
            groupId={span.sentry_tags?.group ?? ''}
            op={span.op ?? ''}
            preliminaryDescription={span.description}
          />
        </SpanDescriptionWrapper>
      ) : (
        span.description
      )}
    </TraceDrawerComponents.TableRow>
  );
}

function partitionSizes(data: RawSpanType['data']): {
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

function SpanKeys({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const {sizeKeys, nonSizeKeys} = partitionSizes(span?.data ?? {});
  const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
    value => value === 0
  );
  const unknownKeys = Object.keys(span).filter(key => {
    return !isHiddenDataKey(key) && !rawSpanKeys.has(key as any);
  });
  const timingKeys = getSpanSubTimings(span) ?? [];

  return (
    <Fragment>
      {allZeroSizes && (
        <TextTr>
          The following sizes were not collected for security reasons. Check if the host
          serves the appropriate
          <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin">
            <span className="val-string">Timing-Allow-Origin</span>
          </ExternalLink>
          header. You may have to enable this collection manually.
        </TextTr>
      )}
      {Object.entries(sizeKeys).map(([key, value]) => (
        <TraceDrawerComponents.TableRow title={key} key={key}>
          <Fragment>
            <FileSize bytes={value} />
            {value >= 1024 && <span>{` (${value} B)`}</span>}
          </Fragment>
        </TraceDrawerComponents.TableRow>
      ))}
      {Object.entries(nonSizeKeys).map(([key, value]) =>
        !isHiddenDataKey(key) ? (
          <TraceDrawerComponents.TableRow title={key} key={key}>
            <GeneralSpanDetailsValue value={value} />
          </TraceDrawerComponents.TableRow>
        ) : null
      )}
      {unknownKeys.map(key => {
        if (key === 'event' || key === 'childTransactions') {
          // dont render the entire JSON payload
          return null;
        }

        return (
          <TraceDrawerComponents.TableRow title={key} key={key}>
            <GeneralSpanDetailsValue value={span[key]} />
          </TraceDrawerComponents.TableRow>
        );
      })}
      {timingKeys.map(timing => (
        <TraceDrawerComponents.TableRow
          title={timing.name}
          key={timing.name}
          prefix={<RowTimingPrefix timing={timing} />}
        >
          {getPerformanceDuration(Number(timing.duration) * 1000)}
        </TraceDrawerComponents.TableRow>
      ))}
    </Fragment>
  );
}

function SpanChild({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const childTransaction = node.value.childTransactions?.[0];

  if (!childTransaction) {
    return null;
  }

  const transactionResult: TransactionResult = {
    'project.name': childTransaction.value.project_slug,
    transaction: childTransaction.value.transaction,
    'trace.span': childTransaction.value.span_id,
    id: childTransaction.value.event_id,
  };

  const eventSlug = generateEventSlug({
    id: transactionResult.id,
    'project.name': transactionResult['project.name'],
  });

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
          projectID: String(childTransaction.value.project_id),
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
    <TraceDrawerComponents.TableRow
      title={t('Child Transaction')}
      extra={viewChildButton}
    >
      {`${transactionResult.transaction} (${transactionResult['project.name']})`}
    </TraceDrawerComponents.TableRow>
  );
}

function SpanChildrenTraversalButton({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  if (!node.value.childTransactions) {
    // TODO: Amend size to use theme when we eventually refactor LoadingIndicator
    // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
    return (
      <StyledDiscoverButton size="xs" disabled>
        <StyledLoadingIndicator size={12} />
      </StyledDiscoverButton>
    );
  }

  if (node.value.childTransactions.length <= 0) {
    return null;
  }

  assert(!isGapSpan(node.value));

  if (node.value.childTransactions.length === 1) {
    // Note: This is rendered by renderSpanChild() as a dedicated row
    return null;
  }

  const {start, end} = getTraceDateTimeRange({
    start: node.value.event.startTimestamp,
    end: node.value.event.endTimestamp,
  });

  const childrenEventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Children from Span ID ${node.value.span_id}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: `event.type:transaction trace:${node.value.trace_id} trace.parent_span:${node.value.span_id}`,
    projects: organization.features.includes('global-views')
      ? [ALL_ACCESS_PROJECTS]
      : [Number(node.value.event.projectID)],
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

function AncestryAndGrouping({
  node,
  onParentClick,
  location,
  organization,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
}) {
  const parentTransaction = node.parent_transaction;
  const span = node.value;
  return (
    <Fragment>
      {parentTransaction ? (
        <TraceDrawerComponents.TableRow title="Parent Transaction">
          <td className="value">
            <a href="#" onClick={() => onParentClick(parentTransaction)}>
              {getTraceTabTitle(parentTransaction)}
            </a>
          </td>
        </TraceDrawerComponents.TableRow>
      ) : null}

      <TraceDrawerComponents.TableRow
        title={
          isGapSpan(span) ? (
            <SpanIdTitle>Span ID</SpanIdTitle>
          ) : (
            <SpanIdTitle
              onClick={scrollToSpan(span.span_id, () => {}, location, organization)}
            >
              Span ID
            </SpanIdTitle>
          )
        }
        extra={<SpanChildrenTraversalButton node={node} organization={organization} />}
      >
        {span.span_id}
        <CopyToClipboardButton borderless size="zero" iconSize="xs" text={span.span_id} />
      </TraceDrawerComponents.TableRow>
      <TraceDrawerComponents.TableRow title={t('Origin')}>
        {span.origin !== undefined ? String(span.origin) : null}
      </TraceDrawerComponents.TableRow>

      <TraceDrawerComponents.TableRow title="Parent Span ID">
        {span.parent_span_id || ''}
      </TraceDrawerComponents.TableRow>
      <SpanChild node={node} organization={organization} location={location} />
      <TraceDrawerComponents.TableRow title={t('Same Process as Parent')}>
        {span.same_process_as_parent !== undefined
          ? String(span.same_process_as_parent)
          : null}
      </TraceDrawerComponents.TableRow>
      <TraceDrawerComponents.TableRow title={t('Span Group')}>
        {defined(span.hash) ? String(span.hash) : null}
      </TraceDrawerComponents.TableRow>
    </Fragment>
  );
}

function DurationSummary({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;
  const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
    getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);
  const duration = endTimestamp - startTimestamp;
  const averageSpanSelfTime: number | undefined =
    span['span.averageResults']?.['avg(span.self_time)'];
  const averageSpanDuration: number | undefined =
    span['span.averageResults']?.['avg(span.duration)'];

  return (
    <Fragment>
      <TraceDrawerComponents.TableRow title={t('Duration')}>
        <TraceDrawerComponents.Duration
          duration={duration}
          baseline={averageSpanDuration ? averageSpanDuration / 1000 : undefined}
          baseDescription={t(
            'Average total time for this span group across the project associated with its parent transaction, over the last 24 hours'
          )}
        />
      </TraceDrawerComponents.TableRow>
      {span.exclusive_time ? (
        <TraceDrawerComponents.TableRow
          title={t('Self Time')}
          toolTipText={t(
            'The time spent exclusively in this span, excluding the total duration of its children'
          )}
        >
          <TraceDrawerComponents.Duration
            ratio={span.exclusive_time / 1000 / duration}
            duration={span.exclusive_time / 1000}
            baseline={averageSpanSelfTime ? averageSpanSelfTime / 1000 : undefined}
            baseDescription={t(
              'Average self time for this span group across the project associated with its parent transaction, over the last 24 hours'
            )}
          />
        </TraceDrawerComponents.TableRow>
      ) : null}
      <TraceDrawerComponents.TableRow title={t('Date Range')}>
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
      </TraceDrawerComponents.TableRow>
    </Fragment>
  );
}

function Tags({span}: {span: RawSpanType}) {
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

function SpanHTTPInfo({span}: {span: RawSpanType}) {
  if (span.op === 'http.client' && span.description) {
    const [method, url] = span.description.split(' ');

    const parsedURL = safeURL(url);
    const queryString = qs.parse(parsedURL?.search ?? '');

    return parsedURL ? (
      <Fragment>
        <TraceDrawerComponents.TableRow title={t('Status')}>
          {span.status || ''}
        </TraceDrawerComponents.TableRow>
        <TraceDrawerComponents.TableRow title={t('HTTP Method')}>
          {method}
        </TraceDrawerComponents.TableRow>
        <TraceDrawerComponents.TableRow title={t('URL')}>
          {parsedURL ? parsedURL?.origin + parsedURL?.pathname : 'failed to parse URL'}
        </TraceDrawerComponents.TableRow>
        <TraceDrawerComponents.TableRow title={t('Query')}>
          {parsedURL
            ? JSON.stringify(queryString, null, 2)
            : 'failed to parse query string'}
        </TraceDrawerComponents.TableRow>
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

const StyledButton = styled(Button)``;

const SpanDetailContainer = styled('div')`
  cursor: auto;
`;

const SpanDetails = styled('div')`
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

export const ButtonGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

export default SpanNodeDetailTable;
