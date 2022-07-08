import {PureComponent} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import maxBy from 'lodash/maxBy';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {TraceError} from 'sentry/utils/performance/quickTrace/types';
import {Theme} from 'sentry/utils/theme';
import withOrganization from 'sentry/utils/withOrganization';

import * as AnchorLinkManager from './anchorLinkManager';
import Filter from './filter';
import TraceErrorList from './traceErrorList';
import TraceView from './traceView';
import {FocusedSpanIDMap, ParsedTraceType} from './types';
import {parseTrace, scrollToSpan} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  event: EventTransaction;
  organization: Organization;
  focusedSpanIds?: FocusedSpanIDMap;
} & WithRouterProps;

type State = {
  parsedTrace: ParsedTraceType;
  waterfallModel: WaterfallModel;
};

class SpansInterface extends PureComponent<Props, State> {
  state: State = {
    parsedTrace: parseTrace(this.props.event),
    waterfallModel: new WaterfallModel(this.props.event, this.props.focusedSpanIds),
  };

  static getDerivedStateFromProps(props: Readonly<Props>, state: State): State {
    if (state.waterfallModel.isEvent(props.event)) {
      return state;
    }

    return {
      ...state,
      parsedTrace: parseTrace(props.event),
      waterfallModel: new WaterfallModel(props.event, props.focusedSpanIds),
    };
  }

  handleSpanFilter = (searchQuery: string) => {
    const {waterfallModel} = this.state;
    const {organization} = this.props;
    waterfallModel.querySpanSearch(searchQuery);

    trackAdvancedAnalyticsEvent('performance_views.event_details.search_query', {
      organization,
    });
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

    return (
      <AlertContainer>
        <Alert type={getCumulativeAlertLevelFromErrors(errors)}>
          <ErrorLabel>
            There is an error event associated with this transaction event.
          </ErrorLabel>

          <AnchorLinkManager.Consumer>
            {({scrollToHash}) => (
              <TraceErrorList
                trace={parsedTrace}
                errors={errors}
                onClickSpan={(event, spanId) => {
                  return scrollToSpan(
                    spanId,
                    scrollToHash,
                    this.props.location,
                    this.props.organization
                  )(event);
                }}
              />
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

  @media (min-width: ${p.theme.breakpoints.small}) {
    padding: ${space(3)} 0 0 0;
  }
  `}
`;

const Search = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: max-content 1fr;
  width: 100%;
  margin-bottom: ${space(2)};
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

export function getCumulativeAlertLevelFromErrors(
  errors?: Pick<TraceError, 'level'>[]
): keyof Theme['alert'] | undefined {
  const highestErrorLevel = maxBy(
    errors || [],
    error => ERROR_LEVEL_WEIGHTS[error.level]
  )?.level;

  if (!highestErrorLevel) {
    return undefined;
  }
  return ERROR_LEVEL_TO_ALERT_TYPE[highestErrorLevel];
}

// Maps the six known error levels to one of three Alert component types
const ERROR_LEVEL_TO_ALERT_TYPE: Record<TraceError['level'], keyof Theme['alert']> = {
  fatal: 'error',
  error: 'error',
  default: 'error',
  warning: 'warning',
  sample: 'info',
  info: 'info',
};

// Allows sorting errors according to their level of severity
const ERROR_LEVEL_WEIGHTS: {
  [Property in TraceError['level']]: number;
} = {
  fatal: 5,
  error: 4,
  default: 4,
  warning: 3,
  sample: 2,
  info: 1,
};

export default withRouter(withOrganization(SpansInterface));
