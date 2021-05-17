import {Component} from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {Panel} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {IconWarning} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';
import {objectIsEmpty} from 'app/utils';
import * as QuickTraceContext from 'app/utils/performance/quickTrace/quickTraceContext';
import {TraceError} from 'app/utils/performance/quickTrace/types';
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
import {parseTrace, scrollToSpan} from './utils';

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
    errors,
    parsedTrace,
  }: {
    isLoading: boolean;
    errors: TraceError[] | undefined;
    parsedTrace: ParsedTraceType;
  }) {
    if (isLoading) {
      return null;
    }

    if (!errors || errors.length <= 0) {
      return null;
    }

    const label = tn(
      'There is an error event associated with this transaction event.',
      `There are %s error events associated with this transaction event.`,
      errors.length
    );

    // mapping from span ids to the span op and the number of errors in that span
    const errorsMap: {
      [spanId: string]: {operation: string; errorsCount: number};
    } = {};

    errors.forEach(error => {
      if (!errorsMap[error.span]) {
        // first check of the error belongs to the root span
        if (parsedTrace.rootSpanID === error.span) {
          errorsMap[error.span] = {
            operation: parsedTrace.op,
            errorsCount: 0,
          };
        } else {
          // since it does not belong to the root span, check if it belongs
          // to one of the other spans in the transaction
          const span = parsedTrace.spans.find(s => s.span_id === error.span);
          if (!span?.op) {
            return;
          }

          errorsMap[error.span] = {
            operation: span.op,
            errorsCount: 0,
          };
        }
      }

      errorsMap[error.span].errorsCount++;
    });

    return (
      <AlertContainer>
        <Alert type="error" icon={<IconWarning size="md" />}>
          <ErrorLabel>{label}</ErrorLabel>
          <AnchorLinkManager.Consumer>
            {({scrollToHash}) => (
              <List symbol="bullet">
                {Object.entries(errorsMap).map(([spanId, {operation, errorsCount}]) => (
                  <ListItem key={spanId}>
                    {tct('[errors] in [link]', {
                      errors: tn('%s error in ', '%s errors in ', errorsCount),
                      link: (
                        <ErrorLink
                          onClick={scrollToSpan(
                            spanId,
                            scrollToHash,
                            this.props.location
                          )}
                        >
                          {operation}
                        </ErrorLink>
                      ),
                    })}
                  </ListItem>
                ))}
              </List>
            )}
          </AnchorLinkManager.Consumer>
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
                errors: quickTrace?.currentEvent?.errors,
                parsedTrace,
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

const ErrorLink = styled('a')`
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
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

const ErrorLabel = styled('div')`
  margin-bottom: ${space(1)};
`;

export default ReactRouter.withRouter(withOrganization(SpansInterface));
