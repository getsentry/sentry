import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';
import * as ReactRouter from 'react-router';

import {t} from 'app/locale';
import SearchBar from 'app/components/searchBar';
import SentryTypes from 'app/sentryTypes';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';
import AlertMessage from 'app/components/alertMessage';
import {TableData} from 'app/views/eventsV2/table/types';

import {SentryTransactionEvent, ParsedTraceType} from './types';
import {parseTrace, getTraceDateTimeRange} from './utils';
import TraceView from './traceView';

type Props = {
  orgId: string;
  event: SentryTransactionEvent;
  eventView: EventView;
} & ReactRouter.WithRouterProps;

type State = {
  parsedTrace: ParsedTraceType;
  searchQuery: string | undefined;
};

class SpansInterface extends React.Component<Props, State> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  state: State = {
    searchQuery: undefined,
    parsedTrace: parseTrace(this.props.event),
  };

  static getDerivedStateFromProps(props: Props, state: State): State {
    return {
      ...state,
      parsedTrace: parseTrace(props.event),
    };
  }

  handleSpanFilter = (searchQuery: string) => {
    this.setState({
      searchQuery: searchQuery || undefined,
    });
  };

  renderTraceErrorsAlert({
    isLoading,
    numOfErrors,
  }: {
    isLoading: boolean;
    numOfErrors: number;
  }) {
    if (isLoading) {
      return null;
    }

    if (numOfErrors === 0) {
      return null;
    }

    const label =
      numOfErrors > 1
        ? t(
            `There are %d error events associated with this transaction event.`,
            numOfErrors
          )
        : t(`There is an error event associated with this transaction event.`);

    return (
      <AlertMessageContainer>
        <AlertMessage
          alert={{
            id: 'id',
            message: <span>{label}</span>,
            type: 'error',
          }}
          system={false}
          hideCloseButton
        />
      </AlertMessageContainer>
    );
  }

  render() {
    const {event, orgId, eventView, location} = this.props;
    const {parsedTrace} = this.state;

    // construct discover query to fetch error events associated with this transaction

    const {start, end} = getTraceDateTimeRange({
      start: parsedTrace.traceStartTimestamp,
      end: parsedTrace.traceEndTimestamp,
    });

    const conditions: QueryResults = {
      query: [],
      'event.type': ['error'],
      trace: [parsedTrace.traceID],
    };

    if (typeof event.title === 'string') {
      conditions.transaction = [event.title];
    }

    const traceErrorsEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Errors related to transaction ${parsedTrace.rootSpanID}`,
      fields: [
        'title',
        'project',
        'timestamp',
        'trace',
        'trace.span',
        'trace.parent_span',
      ],
      orderby: '-timestamp',
      query: stringifyQueryObject(conditions),
      projects: [],
      version: 2,
      start,
      end,
    });

    return (
      <div>
        <DiscoverQuery
          location={location}
          eventView={traceErrorsEventView}
          orgSlug={orgId}
        >
          {({isLoading, tableData}) => {
            const spansWithErrors = filterSpansWithErrors(parsedTrace, tableData);

            const numOfErrors = spansWithErrors?.data.length || 0;

            return (
              <React.Fragment>
                {this.renderTraceErrorsAlert({
                  isLoading,
                  numOfErrors,
                })}
                <StyledSearchBar
                  defaultQuery=""
                  query={this.state.searchQuery || ''}
                  placeholder={t('Search for spans')}
                  onSearch={this.handleSpanFilter}
                />
                <Panel>
                  <TraceView
                    event={event}
                    searchQuery={this.state.searchQuery}
                    orgId={orgId}
                    eventView={eventView}
                    parsedTrace={parsedTrace}
                    spansWithErrors={spansWithErrors}
                  />
                </Panel>
              </React.Fragment>
            );
          }}
        </DiscoverQuery>
      </div>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

const AlertMessageContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

function filterSpansWithErrors(
  parsedTrace: ParsedTraceType,
  tableData: TableData | null | undefined
): TableData | null | undefined {
  if (!tableData) {
    return tableData;
  }

  const data = tableData?.data ?? [];

  const filtered = data.filter(row => {
    const spanID = row['trace.span'] || '';

    if (!spanID) {
      return false;
    }

    if (spanID === parsedTrace.rootSpanID) {
      return true;
    }

    const hasSpan =
      parsedTrace.spans.findIndex(span => {
        return spanID === span.span_id;
      }) >= 0;

    return hasSpan;
  });

  return {
    ...tableData,
    data: filtered,
  };
}

export default ReactRouter.withRouter(SpansInterface);
