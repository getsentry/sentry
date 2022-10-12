import {useMemo} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {TraceError} from 'sentry/utils/performance/quickTrace/types';
import withOrganization from 'sentry/utils/withOrganization';

import * as AnchorLinkManager from './anchorLinkManager';
import Filter from './filter';
import TraceErrorList from './traceErrorList';
import TraceView from './traceView';
import {ParsedTraceType} from './types';
import {getCumulativeAlertLevelFromErrors, parseTrace, scrollToSpan} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  event: EventTransaction;
  organization: Organization;
  affectedSpanIds?: string[];
} & WithRouterProps;

function TraceErrorAlerts({
  isLoading,
  errors,
  parsedTrace,
  location,
  organization,
}: {
  errors: TraceError[] | undefined;
  isLoading: boolean;
  location: Location;
  organization: Organization;
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

  return (
    <AlertContainer>
      <Alert type={getCumulativeAlertLevelFromErrors(errors)}>
        <ErrorLabel>{label}</ErrorLabel>

        <AnchorLinkManager.Consumer>
          {({scrollToHash}) => (
            <TraceErrorList
              trace={parsedTrace}
              errors={errors}
              onClickSpan={(event, spanId) => {
                return scrollToSpan(spanId, scrollToHash, location, organization)(event);
              }}
            />
          )}
        </AnchorLinkManager.Consumer>
      </Alert>
    </AlertContainer>
  );
}

function SpansInterface({event, affectedSpanIds, organization, location}: Props) {
  const parsedTrace = useMemo(() => parseTrace(event), [event]);

  const waterfallModel = useMemo(
    () => new WaterfallModel(event, affectedSpanIds),
    [event, affectedSpanIds]
  );

  const handleSpanFilter = (searchQuery: string) => {
    waterfallModel.querySpanSearch(searchQuery);

    trackAdvancedAnalyticsEvent('performance_views.event_details.search_query', {
      organization,
    });
  };

  return (
    <Container hasErrors={!objectIsEmpty(event.errors)}>
      <QuickTraceContext.Consumer>
        {quickTrace => (
          <AnchorLinkManager.Provider>
            <TraceErrorAlerts
              isLoading={quickTrace?.isLoading ?? false}
              errors={quickTrace?.currentEvent?.errors}
              parsedTrace={parsedTrace}
              organization={organization}
              location={location}
            />
            <Observer>
              {() => {
                return (
                  <Search>
                    <Filter
                      operationNameCounts={waterfallModel.operationNameCounts}
                      operationNameFilter={waterfallModel.operationNameFilters}
                      toggleOperationNameFilter={waterfallModel.toggleOperationNameFilter}
                    />
                    <StyledSearchBar
                      defaultQuery=""
                      query={waterfallModel.searchQuery || ''}
                      placeholder={t('Search for spans')}
                      onSearch={handleSpanFilter}
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

export default withRouter(withOrganization(SpansInterface));
