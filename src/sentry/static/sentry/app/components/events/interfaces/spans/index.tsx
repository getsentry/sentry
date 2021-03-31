import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {Panel} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';
import DiscoverQuery, {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import withOrganization from 'app/utils/withOrganization';

import Filter, {
  ActiveOperationFilter,
  noFilter,
  toggleAllFilters,
  toggleFilter,
} from './filter';
import TraceView from './traceView';
import {ParsedTraceType, SpanErrorMap} from './types';
import {getTraceDateTimeRange, parseTrace} from './utils';

type Props = {
  event: EventTransaction;
  organization: Organization;
} & ReactRouter.WithRouterProps;

type State = {
  parsedTrace: ParsedTraceType;
  searchQuery: string | undefined;
  operationNameFilters: ActiveOperationFilter;
};

class SpansInterface extends React.Component<Props, State> {
  state: State = {
    searchQuery: undefined,
    parsedTrace: parseTrace(this.props.event),
    operationNameFilters: noFilter,
  };

  static getDerivedStateFromProps(props: Readonly<Props>, state: State): State {
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
    spanErrorMap,
  }: {
    isLoading: boolean;
    spanErrorMap: SpanErrorMap | null;
  }) {
    if (isLoading || spanErrorMap === null) {
      return null;
    }

    const spanErrorsList = Object.entries(spanErrorMap);

    if (spanErrorsList.length <= 0) {
      return null;
    }

    const label = tn(
      'There is an error event associated with this transaction event.',
      `There are %s error events associated with this transaction event.`,
      spanErrorsList
        .map(([, spanErrors]) => spanErrors.errors.length)
        .reduce((a, b) => a + b, 0)
    );

    return (
      <AlertContainer>
        <Alert type="error" icon={<IconWarning size="md" />}>
          <ErrorLabel>{label}</ErrorLabel>
          <List symbol="bullet">
            {spanErrorsList.map(([spanId, spanErrors]) => (
              <ListItem key={spanId}>
                {tn('%s error in', '%s errors in', spanErrors.errors.length)}
                {` ${spanErrors.op} \u2014 ${spanErrors.description}`}
              </ListItem>
            ))}
          </List>
        </Alert>
      </AlertContainer>
    );
  }

  toggleOperationNameFilter = (operationName: string) => {
    this.setState(prevState => ({
      operationNameFilters: toggleFilter(prevState.operationNameFilters, operationName),
    }));
  };

  toggleAllOperationNameFilters = (operationNames: string[]) => {
    this.setState(prevState => {
      return {
        operationNameFilters: toggleAllFilters(
          prevState.operationNameFilters,
          operationNames
        ),
      };
    });
  };

  render() {
    const {event, location, organization} = this.props;
    const {parsedTrace} = this.state;

    const orgSlug = organization.slug;

    // construct discover query to fetch error events associated with this transaction

    const {start, end} = getTraceDateTimeRange({
      start: parsedTrace.traceStartTimestamp,
      end: parsedTrace.traceEndTimestamp,
    });

    const conditions = new QueryResults([
      '!event.type:transaction',
      `trace:${parsedTrace.traceID}`,
    ]);

    if (typeof event.title === 'string') {
      conditions.setTagValues('transaction', [event.title]);
    }

    const orgFeatures = new Set(organization.features);

    const traceErrorsEventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Errors related to transaction ${parsedTrace.rootSpanID}`,
      fields: [
        'id',
        'title',
        'project',
        'timestamp',
        'trace',
        'trace.span',
        'trace.parent_span',
        'level',
      ],
      orderby: '-timestamp',
      query: stringifyQueryObject(conditions),
      // if an org has no global-views, we make an assumption that errors are collected in the same
      // project as the current transaction event where spans are collected into
      projects: orgFeatures.has('global-views')
        ? [ALL_ACCESS_PROJECTS]
        : [Number(event.projectID)],
      version: 2,
      start,
      end,
    });

    return (
      <div>
        <DiscoverQuery
          location={location}
          eventView={traceErrorsEventView}
          orgSlug={orgSlug}
        >
          {({isLoading, tableData}) => {
            const spanErrorMap = createSpanErrorMap(parsedTrace, tableData);

            return (
              <React.Fragment>
                {this.renderTraceErrorsAlert({
                  isLoading,
                  spanErrorMap,
                })}
                <Search>
                  <Filter
                    parsedTrace={parsedTrace}
                    operationNameFilter={this.state.operationNameFilters}
                    toggleOperationNameFilter={this.toggleOperationNameFilter}
                    toggleAllOperationNameFilters={this.toggleAllOperationNameFilters}
                  />
                  <StyledSearchBar
                    defaultQuery=""
                    query={this.state.searchQuery || ''}
                    placeholder={t('Search for spans')}
                    onSearch={this.handleSpanFilter}
                  />
                </Search>
                <Panel>
                  <TraceView
                    event={event}
                    searchQuery={this.state.searchQuery}
                    orgId={orgSlug}
                    organization={organization}
                    parsedTrace={parsedTrace}
                    spanErrorMap={spanErrorMap}
                    operationNameFilters={this.state.operationNameFilters}
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

const ErrorLabel = styled('div')`
  margin-bottom: ${space(1)};
`;

const Search = styled('div')`
  display: flex;
  width: 100%;
  margin-bottom: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const AlertContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

function createSpanErrorMap(
  parsedTrace: ParsedTraceType,
  tableData: TableData | null | undefined
): SpanErrorMap | null {
  if (!tableData) {
    return null;
  }

  const data = tableData?.data ?? [];

  const mapping = {};

  data.forEach(row => {
    const spanId = row['trace.span'] || '';
    if (!spanId) {
      return;
    }

    if (spanId === parsedTrace.rootSpanID) {
      if (!mapping[spanId]) {
        mapping[spanId] = {
          op: parsedTrace.op,
          description: parsedTrace.rootSpanID,
          errors: [],
        };
      }

      mapping[spanId].errors.push(row);

      return;
    }

    const span = parsedTrace.spans.find(({span_id}) => span_id === spanId);
    if (span) {
      if (!mapping[spanId]) {
        mapping[spanId] = {
          op: span.op,
          description: span.description,
          errors: [],
        };
      }

      mapping[spanId].errors.push(row);

      return;
    }
  });

  return mapping;
}

export default ReactRouter.withRouter(withOrganization(SpansInterface));
