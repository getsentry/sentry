import type {ReactNode} from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import kebabCase from 'lodash/kebabCase';
import mapValues from 'lodash/mapValues';

import {LinkButton} from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {getKeyValueListData as getRegressionIssueKeyValueList} from 'sentry/components/events/eventStatisticalDetector/eventRegressionSummary';
import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Entry, EntryRequest, Event, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';
import {
  getIssueTypeFromOccurrenceType,
  isOccurrenceBased,
  IssueType,
  isTransactionBased,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

import KeyValueList from '../keyValueList';
import type {ProcessedSpanType, RawSpanType} from '../spans/types';
import {getSpanSubTimings, SpanSubTimingName} from '../spans/utils';

import type {TraceContextSpanProxy} from './spanEvidence';

const formatter = new SQLishFormatter();

type Span = (RawSpanType | TraceContextSpanProxy) & {
  data?: any;
  start_timestamp?: number;
  timestamp?: number;
};

type SpanEvidenceKeyValueListProps = {
  causeSpans: Span[];
  event: EventTransaction;
  location: Location;
  offendingSpans: Span[];
  organization: Organization;
  parentSpan: Span | null;
  issueType?: IssueType;
  projectSlug?: string;
};

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';

function ConsecutiveDBQueriesSpanEvidence({
  event,
  causeSpans,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),
          causeSpans
            ? makeRow(t('Starting Span'), getSpanEvidenceValue(causeSpans[0]!))
            : null,
          makeRow('Parallelizable Spans', offendingSpans.map(getSpanEvidenceValue)),
          makeRow(
            t('Duration Impact'),
            getDurationImpact(
              event,
              getConsecutiveDbTimeSaved(causeSpans, offendingSpans)
            )
          ),
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function ConsecutiveHTTPSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),
          makeRow(
            'Offending Spans',
            offendingSpans.map(span => span.description)
          ),
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function LargeHTTPPayloadSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),
          makeRow(t('Large HTTP Payload Span'), getSpanEvidenceValue(offendingSpans[0]!)),
          makeRow(
            t('Payload Size'),
            getSpanFieldBytes(offendingSpans[0]!, 'http.response_content_length') ??
              getSpanFieldBytes(offendingSpans[0]!, 'Encoded Body Size')
          ),
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function HTTPOverheadSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),

          makeRow(t('Max Queue Time'), getHTTPOverheadMaxTime(offendingSpans)),
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function NPlusOneDBQueriesSpanEvidence({
  event,
  causeSpans,
  parentSpan,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  const dbSpans = offendingSpans.filter(span => (span.op || '').startsWith('db'));
  const repeatingSpanRows = dbSpans
    .filter(span => offendingSpans.find(s => s.hash === span.hash) === span)
    .map((span, i) =>
      makeRow(
        i === 0 ? t('Repeating Spans (%s)', dbSpans.length) : '',
        getSpanEvidenceValue(span)
      )
    );

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),
          parentSpan ? makeRow(t('Parent Span'), getSpanEvidenceValue(parentSpan)) : null,
          causeSpans.length > 0
            ? makeRow(t('Preceding Span'), getSpanEvidenceValue(causeSpans[0]!))
            : null,
          ...repeatingSpanRows,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function NPlusOneAPICallsSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  const requestEntry = event?.entries?.find(isRequestEntry);
  const baseURL = requestEntry?.data?.url;

  const problemParameters = formatChangingQueryParameters(offendingSpans, baseURL);
  const commonPathPrefix = formatBasePath(offendingSpans[0]!, baseURL);

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),
          commonPathPrefix
            ? makeRow(
                t('Repeating Spans (%s)', offendingSpans.length),
                <pre className="val-string">
                  <AnnotatedText
                    value={
                      <Fragment>
                        {commonPathPrefix}
                        <HighlightedEvidence>[Parameters]</HighlightedEvidence>
                      </Fragment>
                    }
                  />
                </pre>
              )
            : null,
          problemParameters.length > 0
            ? makeRow(t('Parameters'), problemParameters)
            : null,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function MainThreadFunctionEvidence({
  event,
  organization,
}: SpanEvidenceKeyValueListProps) {
  const data = useMemo(() => {
    const dataRows: KeyValueListDataItem[] = [];

    const evidenceData = event.occurrence?.evidenceData ?? {};
    const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];

    if (evidenceData.transactionName) {
      const transactionSummaryLocation = transactionSummaryRouteWithQuery({
        orgSlug: organization.slug,
        projectID: event.projectID,
        transaction: evidenceData.transactionName,
        query: {},
      });
      dataRows.push(
        makeRow(
          t('Transaction'),
          <pre>
            <Link to={transactionSummaryLocation}>{evidenceData.transactionName}</Link>
          </pre>
        )
      );
    }

    dataRows.push(
      ...evidenceDisplay.map(item => ({
        subject: item.name,
        key: item.name,
        value: item.value,
      }))
    );

    return dataRows;
  }, [event, organization]);

  return <PresortedKeyValueList data={data} />;
}

function RegressionEvidence({event, issueType}: SpanEvidenceKeyValueListProps) {
  const organization = useOrganization();
  const data = useMemo(
    () =>
      issueType ? getRegressionIssueKeyValueList(organization, issueType, event) : null,
    [organization, event, issueType]
  );
  return data ? <PresortedKeyValueList data={data} /> : null;
}

const PREVIEW_COMPONENTS = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: NPlusOneDBQueriesSpanEvidence,
  [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: NPlusOneAPICallsSpanEvidence,
  [IssueType.PERFORMANCE_SLOW_DB_QUERY]: SlowDBQueryEvidence,
  [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: ConsecutiveDBQueriesSpanEvidence,
  [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: RenderBlockingAssetSpanEvidence,
  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: UncompressedAssetSpanEvidence,
  [IssueType.PERFORMANCE_CONSECUTIVE_HTTP]: ConsecutiveHTTPSpanEvidence,
  [IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD]: LargeHTTPPayloadSpanEvidence,
  [IssueType.PERFORMANCE_HTTP_OVERHEAD]: HTTPOverheadSpanEvidence,
  [IssueType.PERFORMANCE_DURATION_REGRESSION]: RegressionEvidence,
  [IssueType.PERFORMANCE_ENDPOINT_REGRESSION]: RegressionEvidence,
  [IssueType.PROFILE_FILE_IO_MAIN_THREAD]: MainThreadFunctionEvidence,
  [IssueType.PROFILE_IMAGE_DECODE_MAIN_THREAD]: MainThreadFunctionEvidence,
  [IssueType.PROFILE_JSON_DECODE_MAIN_THREAD]: MainThreadFunctionEvidence,
  [IssueType.PROFILE_REGEX_MAIN_THREAD]: MainThreadFunctionEvidence,
  [IssueType.PROFILE_FRAME_DROP]: MainThreadFunctionEvidence,
  [IssueType.PROFILE_FRAME_DROP_EXPERIMENTAL]: MainThreadFunctionEvidence,
  [IssueType.PROFILE_FUNCTION_REGRESSION]: RegressionEvidence,
  [IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL]: RegressionEvidence,
};

export function SpanEvidenceKeyValueList({
  event,
  projectSlug,
}: {
  event: EventTransaction;
  projectSlug?: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const spanInfo = getSpanInfoFromTransactionEvent(event);

  const typeId = event.occurrence?.type;
  const issueType =
    event.perfProblem?.issueType ?? getIssueTypeFromOccurrenceType(typeId);
  const requiresSpanInfo = isTransactionBased(typeId) && isOccurrenceBased(typeId);

  if (!issueType || (requiresSpanInfo && !spanInfo)) {
    return (
      <DefaultSpanEvidence
        event={event}
        offendingSpans={[]}
        location={location}
        causeSpans={[]}
        parentSpan={null}
        organization={organization}
        projectSlug={projectSlug}
      />
    );
  }

  const Component = (PREVIEW_COMPONENTS as any)[issueType] ?? DefaultSpanEvidence;

  return (
    <ClippedBox clipHeight={300}>
      <Component
        event={event}
        issueType={issueType}
        organization={organization}
        location={location}
        projectSlug={projectSlug}
        {...spanInfo}
      />
    </ClippedBox>
  );
}

const HighlightedEvidence = styled('span')`
  color: ${p => p.theme.errorText};
`;

const isRequestEntry = (entry: Entry): entry is EntryRequest => {
  return entry.type === EntryType.REQUEST;
};

function SlowDBQueryEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={[
        makeTransactionNameRow(event, organization, location, projectSlug),
        makeRow(t('Slow DB Query'), getSpanEvidenceValue(offendingSpans[0]!)),
        makeRow(
          t('Duration Impact'),
          getSingleSpanDurationImpact(event, offendingSpans[0]!)
        ),
      ]}
    />
  );
}

function RenderBlockingAssetSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  const offendingSpan = offendingSpans[0]; // For render-blocking assets, there is only one offender

  return (
    <PresortedKeyValueList
      data={[
        makeTransactionNameRow(event, organization, location, projectSlug),
        makeRow(t('Slow Resource Span'), getSpanEvidenceValue(offendingSpan!)),
        makeRow(
          t('FCP Delay'),
          formatDelay(
            getSpanDuration(offendingSpan!),
            event.measurements?.fcp?.value ?? 0
          )
        ),
        makeRow(t('Duration Impact'), getSingleSpanDurationImpact(event, offendingSpan!)),
      ]}
    />
  );
}

function UncompressedAssetSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={[
        makeTransactionNameRow(event, organization, location, projectSlug),
        makeRow(t('Slow Resource Span'), getSpanEvidenceValue(offendingSpans[0]!)),
        makeRow(
          t('Asset Size'),
          getSpanFieldBytes(offendingSpans[0]!, 'http.response_content_length') ??
            getSpanFieldBytes(offendingSpans[0]!, 'Encoded Body Size')
        ),
        makeRow(
          t('Duration Impact'),
          getSingleSpanDurationImpact(event, offendingSpans[0]!)
        ),
      ]}
    />
  );
}

function DefaultSpanEvidence({
  event,
  offendingSpans,
  organization,
  projectSlug,
  location,
}: SpanEvidenceKeyValueListProps) {
  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, organization, location, projectSlug),
          offendingSpans.length > 0
            ? makeRow(t('Offending Span'), getSpanEvidenceValue(offendingSpans[0]!))
            : null,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
}

function PresortedKeyValueList({data}: {data: KeyValueListData}) {
  return <KeyValueList shouldSort={false} data={data} />;
}

const makeTransactionNameRow = (
  event: Event,
  organization: Organization,
  location: Location,
  projectSlug?: string
) => {
  const transactionSummaryLocation = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    projectID: event.projectID,
    transaction: event.title,
    query: {},
  });

  const traceSlug = event.contexts?.trace?.trace_id ?? '';

  const eventDetailsLocation = generateLinkToEventInTraceView({
    traceSlug,
    projectSlug: projectSlug ?? '',
    eventId: event.eventID,
    timestamp: event.endTimestamp ?? '',
    location,
    organization,
  });

  const actionButton = projectSlug ? (
    <LinkButton size="xs" to={eventDetailsLocation}>
      {t('View Full Event')}
    </LinkButton>
  ) : undefined;

  return makeRow(
    t('Transaction'),
    <pre>
      <Link to={transactionSummaryLocation}>{event.title}</Link>
    </pre>,
    actionButton
  );
};

const makeRow = (
  subject: KeyValueListDataItem['subject'],
  value: KeyValueListDataItem['value'],
  actionButton?: ReactNode
): KeyValueListDataItem => {
  const itemKey = kebabCase(subject ?? '');

  return {
    key: itemKey,
    subject,
    value,
    subjectDataTestId: `${TEST_ID_NAMESPACE}.${itemKey}`,
    isMultiValue: Array.isArray(value),
    actionButton,
  };
};

function getSpanEvidenceValue(span: Span | null) {
  if (!span || (!span.op && !span.description)) {
    return t('(no value)');
  }

  if (!span.op && span.description) {
    return span.description;
  }

  if (span.op && !span.description) {
    return span.op;
  }

  if (span.op === 'db' && span.description) {
    return (
      <StyledCodeSnippet language="sql">
        {formatter.toString(span.description)}
      </StyledCodeSnippet>
    );
  }

  return `${span.op} - ${span.description}`;
}

const StyledCodeSnippet = styled(CodeSnippet)`
  pre {
    /* overflow is set to visible in global styles so need to enforce auto here */
    overflow: auto !important;
  }

  z-index: 0;
`;

const getConsecutiveDbTimeSaved = (
  consecutiveSpans: Span[],
  independentSpans: Span[]
): number => {
  const totalDuration = sumSpanDurations(consecutiveSpans);
  const maxIndependentSpanDuration = Math.max(
    ...independentSpans.map(span => getSpanDuration(span))
  );
  const independentSpanIds = independentSpans.map(span => span.span_id);

  let sumOfDependentSpansDuration = 0;
  consecutiveSpans.forEach(span => {
    if (!independentSpanIds.includes(span.span_id)) {
      sumOfDependentSpansDuration += getSpanDuration(span);
    }
  });

  return (
    totalDuration - Math.max(maxIndependentSpanDuration, sumOfDependentSpansDuration)
  );
};

const getHTTPOverheadMaxTime = (offendingSpans: Span[]): string | null => {
  const slowestSpanTimings = getSpanSubTimings(
    offendingSpans[offendingSpans.length - 1] as ProcessedSpanType
  );
  if (!slowestSpanTimings) {
    return null;
  }
  const waitTimeTiming = slowestSpanTimings.find(
    timing => timing.name === SpanSubTimingName.WAIT_TIME
  );
  if (!waitTimeTiming) {
    return null;
  }
  return getPerformanceDuration(waitTimeTiming.duration * 1000);
};

const sumSpanDurations = (spans: Span[]) => {
  let totalDuration = 0;
  spans.forEach(span => {
    totalDuration += getSpanDuration(span);
  });
  return totalDuration;
};

const getSpanDuration = ({timestamp, start_timestamp}: Span) => {
  return ((timestamp ?? 0) - (start_timestamp ?? 0)) * 1000;
};

function getDurationImpact(event: EventTransaction, durationAdded: number) {
  const transactionTime = (event.endTimestamp - event.startTimestamp) * 1000;
  if (!transactionTime) {
    return null;
  }

  return formatDurationImpact(durationAdded, transactionTime);
}

function formatDurationImpact(durationAdded: number, totalDuration: number) {
  const percent = durationAdded / totalDuration;

  return `${toRoundedPercent(percent)} (${getPerformanceDuration(
    durationAdded
  )}/${getPerformanceDuration(totalDuration)})`;
}

function formatDelay(durationAdded: number, totalDuration: number) {
  const percent = durationAdded / totalDuration;

  return `${getPerformanceDuration(durationAdded)} (${toRoundedPercent(
    percent
  )} of ${getPerformanceDuration(totalDuration)})`;
}

function getSingleSpanDurationImpact(event: EventTransaction, span: Span) {
  return getDurationImpact(event, getSpanDuration(span));
}

function getSpanDataField(span: Span, field: string) {
  return span.data?.[field];
}

function getSpanFieldBytes(span: Span, field: string) {
  const bytes = getSpanDataField(span, field);
  if (!bytes) {
    return null;
  }
  return `${formatBytesBase2(bytes)} (${bytes} B)`;
}

type ParameterLookup = Record<string, string[]>;

/**
 * Extracts changing URL query parameters from a list of `http.client` spans.
 * e.g.,
 *
 * https://service.io/r?id=1&filter=none
 * https://service.io/r?id=2&filter=none
 * https://service.io/r?id=3&filter=none
 *
 * @returns A condensed string describing the query parameters changing
 * between the URLs of the given span. e.g., "id:{1,2,3}"
 */
function formatChangingQueryParameters(spans: Span[], baseURL?: string): string[] {
  const URLs = spans
    .map(span => extractSpanURLString(span, baseURL))
    .filter((url): url is URL => url instanceof URL);

  const allQueryParameters = extractQueryParameters(URLs);

  const pairs: string[] = [];
  for (const key in allQueryParameters) {
    const values = allQueryParameters[key]!;

    // By definition, if the parameter only has one value that means it's not
    // changing between calls, so omit it!
    if (values.length > 1) {
      pairs.push(`${key}:{${values.join(',')}}`);
    }
  }

  return pairs;
}

/**
 * Parses the span data and pulls out the URL. Accounts for different SDKs and
 * different versions of SDKs formatting and parsing the URL contents
 * differently. Mirror of `get_url_from_span`. Ideally, this should not exist,
 * and instead it should use the data provided by the backend
 */
export const extractSpanURLString = (span: Span, baseURL?: string): URL | null => {
  let url = span?.data?.url;
  if (url) {
    const query = span.data['http.query'];
    if (query) {
      url += `?${query}`;
    }

    const parsedURL = safeURL(url, baseURL);
    if (parsedURL) {
      return parsedURL;
    }
  }

  const [_method, _url] = (span?.description ?? '').split(' ', 2) as [string, string];

  return safeURL(_url, baseURL) ?? null;
};

export function extractQueryParameters(URLs: URL[]): ParameterLookup {
  const parameterValuesByKey: ParameterLookup = {};

  URLs.forEach(url => {
    for (const [key, value] of url.searchParams) {
      parameterValuesByKey[key] ??= [];
      parameterValuesByKey[key].push(value);
    }
  });

  return mapValues(parameterValuesByKey, parameterList => {
    return Array.from(new Set(parameterList));
  });
}

function formatBasePath(span: Span, baseURL?: string): string {
  const spanURL = extractSpanURLString(span, baseURL);

  return spanURL?.pathname ?? '';
}
