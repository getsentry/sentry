import React from 'react';
import styled from '@emotion/styled';
import map from 'lodash/map';

import {t} from 'app/locale';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import DateTime from 'app/components/dateTime';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {generateEventSlug, eventDetailsRoute} from 'app/utils/discover/urls';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import {assert} from 'app/types/utils';
import AlertMessage from 'app/components/alertMessage';
import {TableDataRow} from 'app/views/eventsV2/table/types';
import Link from 'app/components/links/link';

import {ProcessedSpanType, RawSpanType, ParsedTraceType} from './types';
import {isGapSpan, getTraceDateTimeRange} from './utils';

type TransactionResult = {
  'project.name': string;
  transaction: string;
  id: string;
};

type Props = {
  api: Client;
  orgId: string;
  span: Readonly<ProcessedSpanType>;
  isRoot: boolean;
  eventView: EventView;
  trace: Readonly<ParsedTraceType>;
  totalNumberOfErrors: number;
  spanErrors: TableDataRow[];
};

type State = {
  transactionResults?: TransactionResult[];
};

class SpanDetail extends React.Component<Props, State> {
  state: State = {
    transactionResults: undefined,
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
      .catch(_error => {
        // don't do anything
      });
  }

  fetchSpanDescendents(spanID: string, traceID: string): Promise<any> {
    const {api, orgId, trace} = this.props;

    const url = `/organizations/${orgId}/eventsv2/`;

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
        <StyledButton size="xsmall" disabled>
          <StyledLoadingIndicator size={12} />
        </StyledButton>
      );
    }

    if (this.state.transactionResults.length <= 0) {
      return (
        <StyledButton size="xsmall" disabled>
          {t('No Children')}
        </StyledButton>
      );
    }

    const {span, orgId, trace, eventView} = this.props;

    assert(!isGapSpan(span));

    if (this.state.transactionResults.length === 1) {
      const parentTransactionLink = eventDetailsRoute({
        eventSlug: generateSlug(this.state.transactionResults[0]),
        orgSlug: this.props.orgId,
      });

      const to = {
        pathname: parentTransactionLink,
        query: eventView.generateQueryStringObject(),
      };

      return (
        <StyledButton data-test-id="view-child-transaction" size="xsmall" to={to}>
          {t('View Child')}
        </StyledButton>
      );
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
      projects: eventView.project,
      version: 2,
      start,
      end,
    });

    return (
      <StyledButton
        data-test-id="view-child-transactions"
        size="xsmall"
        to={childrenEventView.getResultsViewUrlTarget(orgId)}
      >
        {t('View Children')}
      </StyledButton>
    );
  }

  renderTraceButton() {
    const {span, orgId, trace, eventView} = this.props;

    const {start, end} = getTraceDateTimeRange({
      start: trace.traceStartTimestamp,
      end: trace.traceEndTimestamp,
    });

    if (isGapSpan(span)) {
      return null;
    }

    const traceEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Transactions with Trace ID ${span.trace_id}`,
      fields: [
        'transaction',
        'project',
        'trace.span',
        'transaction.duration',
        'timestamp',
      ],
      orderby: '-timestamp',
      query: `event.type:transaction trace:${span.trace_id}`,
      projects: eventView.project,
      version: 2,
      start,
      end,
    });

    return (
      <StyledButton size="xsmall" to={traceEventView.getResultsViewUrlTarget(orgId)}>
        {t('Search by Trace')}
      </StyledButton>
    );
  }

  renderSpanErrorMessage() {
    const {orgId, spanErrors, totalNumberOfErrors, span, trace, eventView} = this.props;

    if (spanErrors.length === 0 || totalNumberOfErrors === 0 || isGapSpan(span)) {
      return null;
    }

    // invariant: spanErrors.length <= totalNumberOfErrors

    const eventSlug = generateEventSlug(spanErrors[0]);

    const {start, end} = getTraceDateTimeRange({
      start: trace.traceStartTimestamp,
      end: trace.traceEndTimestamp,
    });

    const errorsEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Error events associated with span ${span.span_id}`,
      fields: ['title', 'project', 'issue', 'timestamp'],
      orderby: '-timestamp',
      query: `event.type:error trace:${span.trace_id} trace.span:${span.span_id}`,
      projects: eventView.project,
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
          <Link to={target}>
            <span>{`${totalNumberOfErrors} error events`}</span>
          </Link>
          <span>{' occurred in this span.'}</span>
        </div>
      ) : (
        <div>
          <Link to={target}>
            <span>{`${spanErrors.length} out of the ${totalNumberOfErrors} error events`}</span>
          </Link>
          <span>{' occurred in this span.'}</span>
        </div>
      );

    return (
      <AlertMessage
        alert={{
          id: `span-error-${span.span_id}`,
          message,
          type: 'error',
        }}
        system
        hideCloseButton
      />
    );
  }

  render() {
    const {span} = this.props;

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;

    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${duration.toFixed(3)}ms`;

    if (isGapSpan(span)) {
      return null;
    }

    return (
      <SpanDetailContainer
        data-component="span-detail"
        onClick={event => {
          // prevent toggling the span detail
          event.stopPropagation();
        }}
      >
        {this.renderSpanErrorMessage()}
        <SpanDetails>
          <table className="table key-value">
            <tbody>
              <Row title="Span ID" extra={this.renderTraversalButton()}>
                {span.span_id}
              </Row>
              <Row title="Trace ID" extra={this.renderTraceButton()}>
                {span.trace_id}
              </Row>
              <Row title="Parent Span ID">{span.parent_span_id || ''}</Row>
              <Row title="Description">{span?.description ?? ''}</Row>
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
                {String(!!span.same_process_as_parent)}
              </Row>
              <Tags span={span} />
              {map(span?.data ?? {}, (value, key) => (
                <Row title={key} key={key}>
                  {JSON.stringify(value, null, 4) || ''}
                </Row>
              ))}
            </tbody>
          </table>
        </SpanDetails>
      </SpanDetailContainer>
    );
  }
}

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const SpanDetailContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.gray1};
  cursor: auto;
`;

const SpanDetails = styled('div')`
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

const Row = ({
  title,
  keep,
  children,
  extra = null,
}: {
  title: string;
  keep?: boolean;
  children: JSX.Element | string;
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

const Tags = ({span}: {span: RawSpanType}) => {
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

export default withApi(SpanDetail);
