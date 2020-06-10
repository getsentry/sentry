import PropTypes from 'prop-types';
import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import {Panel} from 'app/components/panels';
import {SentryTransactionEvent, Organization} from 'app/types';
import {TableData} from 'app/views/eventsV2/table/types';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';
import {t, tn} from 'app/locale';
import Alert from 'app/components/alert';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import SearchBar from 'app/components/searchBar';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import {ParsedTraceType} from './types';
import {parseTrace, getTraceDateTimeRange} from './utils';
import TraceView from './traceView';

type Props = {
  orgId: string;
  event: SentryTransactionEvent;
  eventView: EventView;
  organization: Organization;
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

    const label = tn(
      'There is an error event associated with this transaction event.',
      `There are %s error events associated with this transaction event.`,
      numOfErrors
    );

    return (
      <AlertContainer>
        <Alert type="error" icon={<IconWarning size="md" />}>
          {label}
        </Alert>
      </AlertContainer>
    );
  }

  render() {
    const {event, orgId, eventView, location, organization} = this.props;
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

    const orgFeatures = new Set(organization.features);

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
      // if an org has no global-views, we make an assumption that errors are collected in the same
      // project as the current transaction event where spans are collected into
      projects: orgFeatures.has('global-views') ? [] : [Number(event.projectID)],
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
                    organization={organization}
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

const AlertContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

function filterSpansWithErrors(
  parsedTrace: ParsedTraceType,
  tableData: TableData | null | undefined
): TableData | null | undefined {
  if (!tableData) {
    return undefined;
  }

  const data = tableData?.data ?? [];

  const filtered = data.filter(row => {
    const spanId = row['trace.span'] || '';

    if (!spanId) {
      return false;
    }

    if (spanId === parsedTrace.rootSpanID) {
      return true;
    }

    const hasSpan =
      parsedTrace.spans.findIndex(span => {
        return spanId === span.span_id;
      }) >= 0;

    return hasSpan;
  });

  return {
    ...tableData,
    data: filtered,
  };
}

export default ReactRouter.withRouter(withOrganization(SpansInterface));
