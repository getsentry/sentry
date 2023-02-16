import {Fragment, useMemo} from 'react';
// eslint-disable-next-line no-restricted-imports
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {Alert} from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {TraceError} from 'sentry/utils/performance/quickTrace/types';
import withOrganization from 'sentry/utils/withOrganization';

import Filter from './filter';
import TraceErrorList from './traceErrorList';
import TraceView from './traceView';
import {ParsedTraceType} from './types';
import {getCumulativeAlertLevelFromErrors, parseTrace} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  event: EventTransaction;
  organization: Organization;
  affectedSpanIds?: string[];
};

function TraceErrorAlerts({
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

  return (
    <AlertContainer>
      <Alert type={getCumulativeAlertLevelFromErrors(errors)}>
        <ErrorLabel>{label}</ErrorLabel>

        <TraceErrorList trace={parsedTrace} errors={errors} onClickSpan={() => {}} />
      </Alert>
    </AlertContainer>
  );
}

function SpansInterface({event, affectedSpanIds, organization}: Props) {
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
          <Fragment>
            <TraceErrorAlerts
              isLoading={quickTrace?.isLoading ?? false}
              errors={quickTrace?.currentEvent?.errors}
              parsedTrace={parsedTrace}
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
          </Fragment>
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

export const Spans = withOrganization(SpansInterface);
