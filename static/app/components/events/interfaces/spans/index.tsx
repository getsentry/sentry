import {Component} from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {Panel} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';
import {objectIsEmpty} from 'app/utils';
import * as QuickTraceContext from 'app/utils/performance/quickTrace/quickTraceContext';
import withOrganization from 'app/utils/withOrganization';

import * as AnchorLinkManager from './anchorLinkManager';
import Filter, {
  ActiveOperationFilter,
  noFilter,
  toggleAllFilters,
  toggleFilter,
} from './filter';
import TraceView from './traceView';
import {ParsedTraceType} from './types';
import {parseTrace} from './utils';

type Props = {
  event: EventTransaction;
  organization: Organization;
} & ReactRouter.WithRouterProps;

type State = {
  parsedTrace: ParsedTraceType;
  searchQuery: string | undefined;
  operationNameFilters: ActiveOperationFilter;
};

class SpansInterface extends Component<Props, State> {
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
    const {event, organization} = this.props;
    const {parsedTrace} = this.state;

    return (
      <Container hasErrors={!objectIsEmpty(event.errors)}>
        <QuickTraceContext.Consumer>
          {quickTrace => (
            <AnchorLinkManager.Provider>
              {this.renderTraceErrorsAlert({
                isLoading: quickTrace?.isLoading || false,
                numOfErrors: quickTrace?.currentEvent?.errors?.length ?? 0,
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
                  organization={organization}
                  parsedTrace={parsedTrace}
                  operationNameFilters={this.state.operationNameFilters}
                />
              </Panel>
            </AnchorLinkManager.Provider>
          )}
        </QuickTraceContext.Consumer>
      </Container>
    );
  }
}

const Container = styled('div')<{hasErrors: boolean}>`
  ${p =>
    p.hasErrors &&
    `
  padding: ${space(2)} 0;

  @media (min-width: ${p.theme.breakpoints[0]}) {
    padding: ${space(3)} 0 0 0;
  }
  `}
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

export default ReactRouter.withRouter(withOrganization(SpansInterface));
