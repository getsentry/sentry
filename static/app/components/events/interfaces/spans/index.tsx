import {PureComponent} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {TraceError} from 'sentry/utils/performance/quickTrace/types';
import withOrganization from 'sentry/utils/withOrganization';

import * as AnchorLinkManager from './anchorLinkManager';
import Filter from './filter';
import TraceView from './traceView';
import {ParsedTraceType} from './types';
import {parseTrace, scrollToSpan} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  event: EventTransaction;
  organization: Organization;
} & WithRouterProps;

type State = {
  parsedTrace: ParsedTraceType;
  waterfallModel: WaterfallModel;
};

class SpansInterface extends PureComponent<Props, State> {
  state: State = {
    parsedTrace: parseTrace(this.props.event),
    waterfallModel: new WaterfallModel(this.props.event),
  };

  static getDerivedStateFromProps(props: Readonly<Props>, state: State): State {
    if (state.waterfallModel.isEvent(props.event)) {
      return state;
    }

    return {
      ...state,
      parsedTrace: parseTrace(props.event),
      waterfallModel: new WaterfallModel(props.event),
    };
  }

  handleSpanFilter = (searchQuery: string) => {
    const {waterfallModel} = this.state;
    waterfallModel.querySpanSearch(searchQuery);
  };

  renderTraceErrorsAlert({
    isLoading,
    errors,
    parsedTrace,
  }: {
    errors: TraceError[] | undefined;
    isLoading: boolean;
    parsedTrace: ParsedTraceType;
  }) {
    if (isLoading) {
      return null;
    }

    if (!errors || errors.length <= 0) {
      return null;
    }

    // This is intentional as unbalanced string formatters in `tn()` are problematic
    const label =
      errors.length === 1
        ? t('There is an error event associated with this transaction event.')
        : tn(
            `There are %s error events associated with this transaction event.`,
            `There are %s error events associated with this transaction event.`,
            errors.length
          );

    // mapping from span ids to the span op and the number of errors in that span
    const errorsMap: {
      [spanId: string]: {errorsCount: number; operation: string};
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
                    {tct('[errors] [link]', {
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

  render() {
    const {event, organization} = this.props;
    const {parsedTrace, waterfallModel} = this.state;

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
              <Observer>
                {() => {
                  return (
                    <Search>
                      <Filter
                        operationNameCounts={waterfallModel.operationNameCounts}
                        operationNameFilter={waterfallModel.operationNameFilters}
                        toggleOperationNameFilter={
                          waterfallModel.toggleOperationNameFilter
                        }
                        toggleAllOperationNameFilters={
                          waterfallModel.toggleAllOperationNameFilters
                        }
                      />
                      <StyledSearchBar
                        defaultQuery=""
                        query={waterfallModel.searchQuery || ''}
                        placeholder={t('Search for spans')}
                        onSearch={this.handleSpanFilter}
                      />
                    </Search>
                  );
                }}
              </Observer>
              <Panel>
                <Observer>
                  {() => {
                    return (
                      <TraceView
                        waterfallModel={waterfallModel}
                        organization={organization}
                      />
                    );
                  }}
                </Observer>
                <GuideAnchorWrapper>
                  <GuideAnchor target="span_tree" position="bottom" />
                </GuideAnchorWrapper>
              </Panel>
            </AnchorLinkManager.Provider>
          )}
        </QuickTraceContext.Consumer>
      </Container>
    );
  }
}

const GuideAnchorWrapper = styled('div')`
  height: 0;
  width: 0;
  margin-left: 50%;
`;

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

export default withRouter(withOrganization(SpansInterface));
