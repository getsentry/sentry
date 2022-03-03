import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import map from 'lodash/map';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
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
import {
  generateIssueEventTarget,
  generateTraceTarget,
} from 'sentry/components/quickTrace/utils';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconAnchor, IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getDynamicText from 'sentry/utils/getDynamicText';
import {QuickTraceEvent, TraceError} from 'sentry/utils/performance/quickTrace/types';
import withApi from 'sentry/utils/withApi';

import * as SpanEntryContext from './context';
import InlineDocs from './inlineDocs';
import {ParsedTraceType, ProcessedSpanType, rawSpanKeys, RawSpanType} from './types';
import {getTraceDateTimeRange, isGapSpan, isOrphanSpan, scrollToSpan} from './utils';

const DEFAULT_ERRORS_VISIBLE = 5;

const SIZE_DATA_KEYS = ['Encoded Body Size', 'Decoded Body Size', 'Transfer Size'];

type TransactionResult = {
  id: string;
  'project.name': string;
  'trace.span': string;
  transaction: string;
};

type Props = WithRouterProps & {
  api: Client;
  childTransactions: QuickTraceEvent[] | null;
  event: Readonly<EventTransaction>;
  isRoot: boolean;
  organization: Organization;
  relatedErrors: TraceError[] | null;
  scrollToHash: (hash: string) => void;
  span: Readonly<ProcessedSpanType>;
  trace: Readonly<ParsedTraceType>;
};

type State = {
  errorsOpened: boolean;
};

class SpanDetail extends React.Component<Props, State> {
  state: State = {
    errorsOpened: false,
  };

  renderTraversalButton(): React.ReactNode {
    if (!this.props.childTransactions) {
      // TODO: Amend size to use theme when we eventually refactor LoadingIndicator
      // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
      return (
        <StyledDiscoverButton size="xsmall" disabled>
          <StyledLoadingIndicator size={12} />
        </StyledDiscoverButton>
      );
    }

    if (this.props.childTransactions.length <= 0) {
      return (
        <StyledDiscoverButton size="xsmall" disabled>
          {t('No Children')}
        </StyledDiscoverButton>
      );
    }

    const {span, trace, event, organization} = this.props;

    assert(!isGapSpan(span));

    if (this.props.childTransactions.length === 1) {
      // Note: This is rendered by this.renderSpanChild() as a dedicated row
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
        size="xsmall"
        to={childrenEventView.getResultsViewUrlTarget(organization.slug)}
      >
        {t('View Children')}
      </StyledDiscoverButton>
    );
  }

  renderSpanChild(): React.ReactNode {
    const {childTransactions} = this.props;

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

          return (
            <StyledButton data-test-id="view-child-transaction" size="xsmall" to={to}>
              {t('View Transaction')}
            </StyledButton>
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

  renderTraceButton() {
    const {span, organization, event} = this.props;

    if (isGapSpan(span)) {
      return null;
    }

    return (
      <StyledButton size="xsmall" to={generateTraceTarget(event, organization)}>
        {t('View Trace')}
      </StyledButton>
    );
  }

  renderOrphanSpanMessage() {
    const {span} = this.props;

    if (!isOrphanSpan(span)) {
      return null;
    }

    return (
      <Alert system type="info" icon={<IconWarning size="md" />}>
        {t(
          'This is a span that has no parent span within this transaction. It has been attached to the transaction root span by default.'
        )}
      </Alert>
    );
  }

  toggleErrors = () => {
    this.setState(({errorsOpened}) => ({errorsOpened: !errorsOpened}));
  };

  renderSpanErrorMessage() {
    const {span, organization, relatedErrors} = this.props;
    const {errorsOpened} = this.state;

    if (!relatedErrors || relatedErrors.length <= 0 || isGapSpan(span)) {
      return null;
    }

    const visibleErrors = errorsOpened
      ? relatedErrors
      : relatedErrors.slice(0, DEFAULT_ERRORS_VISIBLE);

    return (
      <Alert system type="error" icon={<IconWarning size="md" />}>
        <ErrorMessageTitle>
          {tn(
            'An error event occurred in this transaction.',
            '%s error events occurred in this transaction.',
            relatedErrors.length
          )}
        </ErrorMessageTitle>
        <ErrorMessageContent>
          {visibleErrors.map(error => (
            <React.Fragment key={error.event_id}>
              <ErrorDot level={error.level} />
              <ErrorLevel>{error.level}</ErrorLevel>
              <ErrorTitle>
                <Link to={generateIssueEventTarget(error, organization)}>
                  {error.title}
                </Link>
              </ErrorTitle>
            </React.Fragment>
          ))}
        </ErrorMessageContent>
        {relatedErrors.length > DEFAULT_ERRORS_VISIBLE && (
          <ErrorToggle size="xsmall" onClick={this.toggleErrors}>
            {errorsOpened ? t('Show less') : t('Show more')}
          </ErrorToggle>
        )}
      </Alert>
    );
  }

  partitionSizes(data) {
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

  renderSpanDetails() {
    const {span, event, location, organization, scrollToHash} = this.props;

    if (isGapSpan(span)) {
      return (
        <SpanDetails>
          <InlineDocs
            platform={event.sdk?.name || ''}
            orgSlug={organization.slug}
            projectSlug={event?.projectSlug ?? ''}
          />
        </SpanDetails>
      );
    }

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;

    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;

    const unknownKeys = Object.keys(span).filter(key => {
      return !rawSpanKeys.has(key as any);
    });

    const {sizeKeys, nonSizeKeys} = this.partitionSizes(span?.data ?? {});

    const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
      value => value === 0
    );

    return (
      <React.Fragment>
        {this.renderOrphanSpanMessage()}
        {this.renderSpanErrorMessage()}
        <SpanDetails>
          <table className="table key-value">
            <tbody>
              <Row
                title={
                  isGapSpan(span) ? (
                    <SpanIdTitle>Span ID</SpanIdTitle>
                  ) : (
                    <SpanIdTitle
                      onClick={scrollToSpan(span.span_id, scrollToHash, location)}
                    >
                      Span ID
                      <StyledIconAnchor />
                    </SpanIdTitle>
                  )
                }
                extra={this.renderTraversalButton()}
              >
                {span.span_id}
              </Row>
              <Row title="Parent Span ID">{span.parent_span_id || ''}</Row>
              {this.renderSpanChild()}
              <Row title="Trace ID" extra={this.renderTraceButton()}>
                {span.trace_id}
              </Row>
              <Row title="Description">{span?.description ?? ''}</Row>
              <Row title="Status">{span.status || ''}</Row>
              <Row title="Start Date">
                {getDynamicText({
                  fixed: 'Mar 16, 2020 9:10:12 AM UTC',
                  value: (
                    <React.Fragment>
                      <DateTime date={startTimestamp * 1000} />
                      {` (${startTimestamp})`}
                    </React.Fragment>
                  ),
                })}
              </Row>
              <Row title="End Date">
                {getDynamicText({
                  fixed: 'Mar 16, 2020 9:10:13 AM UTC',
                  value: (
                    <React.Fragment>
                      <DateTime date={endTimestamp * 1000} />
                      {` (${endTimestamp})`}
                    </React.Fragment>
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
              <Feature
                organization={organization}
                features={['organizations:performance-suspect-spans-view']}
              >
                <Row title="Span Group">
                  {defined(span.hash) ? String(span.hash) : null}
                </Row>
                <Row title="Span Self Time">
                  {defined(span.exclusive_time)
                    ? `${Number(span.exclusive_time.toFixed(3)).toLocaleString()}ms`
                    : null}
                </Row>
              </Feature>
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
                  <React.Fragment>
                    <FileSize bytes={value} />
                    {value >= 1024 && (
                      <span>{` (${JSON.stringify(value, null, 4) || ''} B)`}</span>
                    )}
                  </React.Fragment>
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
      </React.Fragment>
    );
  }

  render() {
    return (
      <SpanDetailContainer
        data-component="span-detail"
        onClick={event => {
          // prevent toggling the span detail
          event.stopPropagation();
        }}
      >
        {this.renderSpanDetails()}
      </SpanDetailContainer>
    );
  }
}

const StyledDiscoverButton = styled(DiscoverButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

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

const StyledIconAnchor = styled(IconAnchor)`
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
        <pre className="val">
          <span className="val-string">{children}</span>
        </pre>
        {extra}
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

export default withApi(withRouter(SpanDetail));
