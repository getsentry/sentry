import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import map from 'lodash/map';
import omit from 'lodash/omit';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import DateTime from 'sentry/components/dateTime';
import DiscoverButton from 'sentry/components/discoverButton';
import FileSize from 'sentry/components/fileSize';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorMessageTitle,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {useTransactionProfileId} from 'sentry/components/profiling/transactionProfileIdProvider';
import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import {
  generateIssueEventTarget,
  generateTraceTarget,
} from 'sentry/components/quickTrace/utils';
import {ALL_ACCESS_PROJECTS, PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {IconLink} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getDynamicText from 'sentry/utils/getDynamicText';
import {QuickTraceEvent, TraceError} from 'sentry/utils/performance/quickTrace/types';
import {useLocation} from 'sentry/utils/useLocation';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import * as SpanEntryContext from './context';
import {GapSpanDetails} from './gapSpanDetails';
import InlineDocs from './inlineDocs';
import {SpanProfileDetails} from './spanProfileDetails';
import {ParsedTraceType, ProcessedSpanType, rawSpanKeys, RawSpanType} from './types';
import {
  getCumulativeAlertLevelFromErrors,
  getFormattedTimeRangeWithLeadingAndTrailingZero,
  getTraceDateTimeRange,
  isGapSpan,
  isOrphanSpan,
  scrollToSpan,
} from './utils';

const DEFAULT_ERRORS_VISIBLE = 5;

const SIZE_DATA_KEYS = ['Encoded Body Size', 'Decoded Body Size', 'Transfer Size'];

type TransactionResult = {
  id: string;
  'project.name': string;
  'trace.span': string;
  transaction: string;
};

type Props = {
  childTransactions: QuickTraceEvent[] | null;
  event: Readonly<EventTransaction>;
  isRoot: boolean;
  organization: Organization;
  relatedErrors: TraceError[] | null;
  resetCellMeasureCache: () => void;
  scrollToHash: (hash: string) => void;
  span: Readonly<ProcessedSpanType>;
  trace: Readonly<ParsedTraceType>;
};

function SpanDetail(props: Props) {
  const [errorsOpened, setErrorsOpened] = useState(false);
  const location = useLocation();
  const profileId = useTransactionProfileId();

  useEffect(() => {
    // Run on mount.

    const {span, organization, event} = props;
    if ('type' in span) {
      return;
    }

    trackAdvancedAnalyticsEvent('performance_views.event_details.open_span_details', {
      organization,
      operation: span.op ?? 'undefined',
      project_platform: event.platform ?? 'undefined',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const orgFeatures = new Set(organization.features);

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
      projects: orgFeatures.has('global-views')
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
      <Row title="Child Transaction" extra={viewChildButton}>
        {`${transactionResult.transaction} (${transactionResult['project.name']})`}
      </Row>
    );
  }

  function renderTraceButton() {
    const {span, organization, event} = props;

    if (isGapSpan(span)) {
      return null;
    }

    return (
      <StyledButton size="xs" to={generateTraceTarget(event, organization)}>
        {t('View Trace')}
      </StyledButton>
    );
  }

  function renderViewSimilarSpansButton() {
    const {span, organization, event} = props;

    if (isGapSpan(span) || !span.op || !span.hash) {
      return null;
    }

    const transactionName = event.title;

    const target = spanDetailsRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      query: location.query,
      spanSlug: {op: span.op, group: span.hash},
      projectID: event.projectID,
    });

    return (
      <StyledButton size="xs" to={target}>
        {t('View Similar Spans')}
      </StyledButton>
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

  function toggleErrors() {
    setErrorsOpened(prevErrorsOpened => !prevErrorsOpened);
  }

  function renderSpanErrorMessage() {
    const {span, organization, relatedErrors} = props;

    if (!relatedErrors || relatedErrors.length <= 0 || isGapSpan(span)) {
      return null;
    }

    const visibleErrors = errorsOpened
      ? relatedErrors
      : relatedErrors.slice(0, DEFAULT_ERRORS_VISIBLE);

    return (
      <Alert type={getCumulativeAlertLevelFromErrors(relatedErrors)} system>
        <ErrorMessageTitle>
          {tn(
            '%s error event occurred in this span.',
            '%s error events occurred in this span.',
            relatedErrors.length
          )}
        </ErrorMessageTitle>
        <ErrorMessageContent>
          {visibleErrors.map(error => (
            <Fragment key={error.event_id}>
              <ErrorDot level={error.level} />
              <ErrorLevel>{error.level}</ErrorLevel>
              <ErrorTitle>
                <Link to={generateIssueEventTarget(error, organization)}>
                  {error.title}
                </Link>
              </ErrorTitle>
            </Fragment>
          ))}
        </ErrorMessageContent>
        {relatedErrors.length > DEFAULT_ERRORS_VISIBLE && (
          <ErrorToggle size="xs" onClick={toggleErrors}>
            {errorsOpened ? t('Show less') : t('Show more')}
          </ErrorToggle>
        )}
      </Alert>
    );
  }

  function partitionSizes(data) {
    const sizeKeys = SIZE_DATA_KEYS.reduce((keys, key) => {
      if (data.hasOwnProperty(key)) {
        keys[key] = data[key];
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

    if (!organization.features.includes('profiling-span-previews') || isGapSpan(span)) {
      return null;
    }

    return <SpanProfileDetails span={span} event={event} />;
  }

  function renderSpanDetails() {
    const {span, event, organization, resetCellMeasureCache, scrollToHash} = props;

    if (isGapSpan(span)) {
      return (
        <SpanDetails>
          {organization.features.includes('profiling-previews') ? (
            <GapSpanDetails
              event={event}
              span={span}
              resetCellMeasureCache={resetCellMeasureCache}
            />
          ) : (
            <InlineDocs
              orgSlug={organization.slug}
              platform={event.sdk?.name || ''}
              projectSlug={event?.projectSlug ?? ''}
              resetCellMeasureCache={resetCellMeasureCache}
            />
          )}
        </SpanDetails>
      );
    }

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;
    const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
      getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);

    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;

    const unknownKeys = Object.keys(span).filter(key => {
      return !rawSpanKeys.has(key as any);
    });

    const {sizeKeys, nonSizeKeys} = partitionSizes(span?.data ?? {});

    const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
      value => value === 0
    );

    return (
      <Fragment>
        {renderOrphanSpanMessage()}
        {renderSpanErrorMessage()}
        {renderProfileMessage()}
        <SpanDetails>
          <table className="table key-value">
            <tbody>
              <Row
                title={
                  isGapSpan(span) ? (
                    <SpanIdTitle>Span ID</SpanIdTitle>
                  ) : (
                    <SpanIdTitle
                      onClick={scrollToSpan(
                        span.span_id,
                        scrollToHash,
                        location,
                        organization
                      )}
                    >
                      Span ID
                      <Clipboard
                        value={`${window.location.href.replace(
                          window.location.hash,
                          ''
                        )}#span-${span.span_id}`}
                      >
                        <StyledIconLink />
                      </Clipboard>
                    </SpanIdTitle>
                  )
                }
                extra={renderTraversalButton()}
              >
                {span.span_id}
              </Row>
              <Row title="Parent Span ID">{span.parent_span_id || ''}</Row>
              {renderSpanChild()}
              <Row title="Trace ID" extra={renderTraceButton()}>
                {span.trace_id}
              </Row>
              {profileId && event.projectSlug && (
                <Row
                  title="Profile ID"
                  extra={
                    <TransactionToProfileButton
                      size="xs"
                      projectSlug={event.projectSlug}
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
              <Row title="Description" extra={renderViewSimilarSpansButton()}>
                {span?.description ?? ''}
              </Row>
              <Row title="Status">{span.status || ''}</Row>
              <Row title="Start Date">
                {getDynamicText({
                  fixed: 'Mar 16, 2020 9:10:12 AM UTC',
                  value: (
                    <Fragment>
                      <DateTime date={startTimestamp * 1000} year seconds timeZone />
                      {` (${startTimeWithLeadingZero})`}
                    </Fragment>
                  ),
                })}
              </Row>
              <Row title="End Date">
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
              <Row title="Duration">{durationString}</Row>
              <Row title="Operation">{span.op || ''}</Row>
              <Row title="Same Process as Parent">
                {span.same_process_as_parent !== undefined
                  ? String(span.same_process_as_parent)
                  : null}
              </Row>
              <Row title="Span Group">
                {defined(span.hash) ? String(span.hash) : null}
              </Row>
              <Row title="Span Self Time">
                {defined(span.exclusive_time)
                  ? `${Number(span.exclusive_time.toFixed(3)).toLocaleString()}ms`
                  : null}
              </Row>
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
              {map(sizeKeys, (value, key) => (
                <Row title={key} key={key}>
                  <Fragment>
                    <FileSize bytes={value} />
                    {value >= 1024 && (
                      <span>{` (${JSON.stringify(value, null, 4) || ''} B)`}</span>
                    )}
                  </Fragment>
                </Row>
              ))}
              {map(nonSizeKeys, (value, key) => (
                <Row title={key} key={key}>
                  {JSON.stringify(value, null, 4) || ''}
                </Row>
              ))}
              {unknownKeys.map(key => (
                <Row title={key} key={key}>
                  {JSON.stringify(span[key], null, 4) || ''}
                </Row>
              ))}
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
  padding: ${space(2)};
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

const TextTr = ({children}) => (
  <tr>
    <td className="key" />
    <ValueTd className="value">
      <StyledText>{children}</StyledText>
    </ValueTd>
  </tr>
);

const ErrorToggle = styled(Button)`
  margin-top: ${space(0.75)};
`;

const SpanIdTitle = styled('a')`
  display: flex;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledIconLink = styled(IconLink)`
  display: block;
  color: ${p => p.theme.gray300};
  margin-left: ${space(1)};
`;

export const Row = ({
  title,
  keep,
  children,
  extra = null,
}: {
  children: JSX.Element | string | null;
  title: JSX.Element | string | null;
  extra?: React.ReactNode;
  keep?: boolean;
}) => {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">{title}</td>
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
};

export const Tags = ({span}: {span: RawSpanType}) => {
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
};

function generateSlug(result: TransactionResult): string {
  return generateEventSlug({
    id: result.id,
    'project.name': result['project.name'],
  });
}

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

export default SpanDetail;
