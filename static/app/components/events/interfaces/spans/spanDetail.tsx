import * as React from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import map from 'lodash/map';

import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import DateTime from 'app/components/dateTime';
import DiscoverButton from 'app/components/discoverButton';
import FileSize from 'app/components/fileSize';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorMessageTitle,
  ErrorTitle,
} from 'app/components/performance/waterfall/rowDetails';
import Pill from 'app/components/pill';
import Pills from 'app/components/pills';
import {
  generateIssueEventTarget,
  generateTraceTarget,
} from 'app/components/quickTrace/utils';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconAnchor, IconChevron, IconWarning} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';
import {assert} from 'app/types/utils';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {eventDetailsRoute, generateEventSlug} from 'app/utils/discover/urls';
import getDynamicText from 'app/utils/getDynamicText';
import {QuickTraceEvent, TraceError} from 'app/utils/performance/quickTrace/types';
import withApi from 'app/utils/withApi';

import * as SpanEntryContext from './context';
import InlineDocs from './inlineDocs';
import {ParsedTraceType, ProcessedSpanType, rawSpanKeys, RawSpanType} from './types';
import {getTraceDateTimeRange, isGapSpan, isOrphanSpan} from './utils';

const SIZE_DATA_KEYS = ['Encoded Body Size', 'Decoded Body Size', 'Transfer Size'];

type TransactionResult = {
  'project.name': string;
  transaction: string;
  'trace.span': string;
  id: string;
};

type Props = WithRouterProps & {
  api: Client;
  orgId: string;
  organization: Organization;
  event: Readonly<EventTransaction>;
  span: Readonly<ProcessedSpanType>;
  isRoot: boolean;
  trace: Readonly<ParsedTraceType>;
  totalNumberOfErrors: number;
  spanErrors: TableDataRow[];
  childTransactions: QuickTraceEvent[];
  relatedErrors: TraceError[];
  scrollToHash: (hash: string) => void;
};

type State = {
  transactionResults?: TransactionResult[];
  errorsOpened: boolean;
};

class SpanDetail extends React.Component<Props, State> {
  state: State = {
    transactionResults: undefined,
    errorsOpened: false,
  };

  componentDidMount() {
    const {span} = this.props;

    if (isGapSpan(span)) {
      return;
    }

    this.fetchSpanDescendents(span.span_id, span.trace_id)
      .then(response => {
        if (!response.data || !Array.isArray(response.data)) {
          return;
        }

        this.setState({
          transactionResults: response.data,
        });
      })
      .catch(error => {
        Sentry.captureException(error);
      });
  }

  fetchSpanDescendents(
    spanID: string,
    traceID: string
  ): Promise<{data: TransactionResult[]}> {
    const {api, organization, childTransactions, trace, event} = this.props;

    // Skip doing a request if the results will be behind a disabled button.
    if (!organization.features.includes('discover-basic')) {
      return Promise.resolve({data: []});
    }

    // Quick trace found some results that we can use to link to child
    // spans without making additional queries.
    if (childTransactions.length) {
      return Promise.resolve({
        data: childTransactions.map(child => ({
          'project.name': child.project_slug,
          transaction: child.transaction,
          'trace.span': child.span_id,
          id: child.event_id,
        })),
      });
    }

    const url = `/organizations/${organization.slug}/eventsv2/`;

    const {start, end} = getParams(
      getTraceDateTimeRange({
        start: trace.traceStartTimestamp,
        end: trace.traceEndTimestamp,
      })
    );

    const query = {
      field: ['transaction', 'id', 'trace.span'],
      sort: ['-id'],
      query: `event.type:transaction trace:${traceID} trace.parent_span:${spanID}`,
      project: organization.features.includes('global-views')
        ? [ALL_ACCESS_PROJECTS]
        : [Number(event.projectID)],
      referrer: 'api.trace-view.span-detail',
      start,
      end,
    };

    return api.requestPromise(url, {
      method: 'GET',
      query,
    });
  }

  renderTraversalButton(): React.ReactNode {
    if (!this.state.transactionResults) {
      // TODO: Amend size to use theme when we evetually refactor LoadingIndicator
      // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
      return (
        <StyledDiscoverButton size="xsmall" disabled>
          <StyledLoadingIndicator size={12} />
        </StyledDiscoverButton>
      );
    }

    if (this.state.transactionResults.length <= 0) {
      return (
        <StyledDiscoverButton size="xsmall" disabled>
          {t('No Children')}
        </StyledDiscoverButton>
      );
    }

    const {span, orgId, trace, event, organization} = this.props;

    assert(!isGapSpan(span));

    if (this.state.transactionResults.length === 1) {
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
        to={childrenEventView.getResultsViewUrlTarget(orgId)}
      >
        {t('View Children')}
      </StyledDiscoverButton>
    );
  }

  renderSpanChild(): React.ReactNode {
    if (!this.state.transactionResults || this.state.transactionResults.length !== 1) {
      return null;
    }

    const eventSlug = generateSlug(this.state.transactionResults[0]);

    const viewChildButton = (
      <SpanEntryContext.Consumer>
        {({getViewChildTransactionTarget}) => {
          const to = getViewChildTransactionTarget({
            ...this.state.transactionResults![0],
            eventSlug,
          });

          if (!to) {
            return null;
          }

          return (
            <StyledDiscoverButton
              data-test-id="view-child-transaction"
              size="xsmall"
              to={to}
            >
              {t('View Transaction')}
            </StyledDiscoverButton>
          );
        }}
      </SpanEntryContext.Consumer>
    );

    const results = this.state.transactionResults[0];

    return (
      <Row title="Child Transaction" extra={viewChildButton}>
        {`${results.transaction} (${results['project.name']})`}
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
    const {
      orgId,
      spanErrors,
      totalNumberOfErrors,
      span,
      trace,
      organization,
      event,
      relatedErrors,
    } = this.props;
    const {errorsOpened} = this.state;

    /**
     * Use the related errors as the default and fall back to span errors if this is
     * empty. This fall back can be removed once trace navigation rollout is complete.
     */
    if (relatedErrors.length) {
      return (
        <Alert system type="error" icon={<IconWarning size="md" />}>
          <ErrorMessageTitle>
            {tn(
              'An error event occurred in this transaction.',
              '%s error events occurred in this transaction.',
              relatedErrors.length
            )}
            <Toggle priority="link" onClick={this.toggleErrors}>
              <IconChevron direction={errorsOpened ? 'up' : 'down'} />
            </Toggle>
          </ErrorMessageTitle>
          {errorsOpened && (
            <ErrorMessageContent>
              {relatedErrors.map(error => (
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
          )}
        </Alert>
      );
    }

    if (spanErrors.length === 0 || totalNumberOfErrors === 0 || isGapSpan(span)) {
      return null;
    }

    // invariant: spanErrors.length <= totalNumberOfErrors

    const eventSlug = generateEventSlug(spanErrors[0]);

    const {start, end} = getTraceDateTimeRange({
      start: trace.traceStartTimestamp,
      end: trace.traceEndTimestamp,
    });

    const orgFeatures = new Set(organization.features);

    const errorsEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Error events associated with span ${span.span_id}`,
      fields: ['title', 'project', 'issue', 'timestamp'],
      orderby: '-timestamp',
      query: `event.type:error trace:${span.trace_id} trace.span:${span.span_id}`,
      projects: orgFeatures.has('global-views')
        ? [ALL_ACCESS_PROJECTS]
        : [Number(event.projectID)],
      version: 2,
      start,
      end,
    });

    const target =
      spanErrors.length === 1
        ? {
            pathname: eventDetailsRoute({
              orgSlug: orgId,
              eventSlug,
            }),
          }
        : errorsEventView.getResultsViewUrlTarget(orgId);

    const message =
      totalNumberOfErrors === 1 ? (
        <Link to={target}>
          <span>{t('An error event occurred in this span.')}</span>
        </Link>
      ) : spanErrors.length === totalNumberOfErrors ? (
        <div>
          {tct('[link] occurred in this span.', {
            link: (
              <Link to={target}>
                <span>{t('%d error events', totalNumberOfErrors)}</span>
              </Link>
            ),
          })}
        </div>
      ) : (
        <div>
          {tct('[link] occurred in this span.', {
            link: (
              <Link to={target}>
                <span>
                  {t('%d out of %d error events', spanErrors.length, totalNumberOfErrors)}
                </span>
              </Link>
            ),
          })}
        </div>
      );

    return (
      <Alert system type="error" icon={<IconWarning size="md" />}>
        {message}
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

  scrollBarIntoView = (spanId: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // do not use the default anchor behaviour
    // because it will be hidden behind the minimap
    e.preventDefault();

    const hash = `#span-${spanId}`;

    this.props.scrollToHash(hash);

    // TODO(txiao): This is causing a rerender of the whole page,
    // which can be slow.
    //
    // make sure to update the location
    browserHistory.push({
      ...this.props.location,
      hash,
    });
  };

  renderSpanDetails() {
    const {span, event, organization} = this.props;

    if (isGapSpan(span)) {
      return (
        <SpanDetails>
          <InlineDocs
            platform={event.sdk?.name || ''}
            orgSlug={organization.slug}
            projectSlug={event.projectSlug}
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
                    <SpanIdTitle onClick={this.scrollBarIntoView(span.span_id)}>
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

const Toggle = styled(Button)`
  font-weight: bold;
  color: ${p => p.theme.subText};
  :hover {
    color: ${p => p.theme.textColor};
  }
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
  title: JSX.Element | string | null;
  children: JSX.Element | string | null;
  keep?: boolean;
  extra?: React.ReactNode;
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
