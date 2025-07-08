import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {Alert} from 'sentry/components/core/alert';
import Panel from 'sentry/components/panels/panel';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import type {
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceError} from 'sentry/utils/performance/quickTrace/utils';
import useOrganization from 'sentry/utils/useOrganization';

import Filter from './filter';
import TraceErrorList from './traceErrorList';
import TraceView from './traceView';
import type {ParsedTraceType} from './types';
import {getCumulativeAlertLevelFromErrors, parseTrace} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  event: EventTransaction;
  affectedSpanIds?: string[];
};

function TraceErrorAlerts({
  isLoading,
  errors,
  parsedTrace,
  performanceIssues,
}: {
  errors: TraceError[] | undefined;
  isLoading: boolean;
  parsedTrace: ParsedTraceType;
  performanceIssues: TracePerformanceIssue[] | undefined;
}) {
  if (isLoading) {
    return null;
  }

  const traceErrors: Array<TraceError | TracePerformanceIssue> = [];
  if (errors && errors.length > 0) {
    traceErrors.push(...errors);
  }
  if (performanceIssues && performanceIssues.length > 0) {
    traceErrors.push(...performanceIssues);
  }
  if (traceErrors.length === 0) {
    return null;
  }

  // This is intentional as unbalanced string formatters in `tn()` are problematic
  const label =
    traceErrors.length === 1
      ? t('There is an issue associated with this transaction event.')
      : tn(
          `There are %s issues associated with this transaction event.`,
          `There are %s issues associated with this transaction event.`,
          traceErrors.length
        );

  return (
    <AlertContainer>
      <Alert type={getCumulativeAlertLevelFromErrors(traceErrors) ?? 'info'}>
        <ErrorLabel>{label}</ErrorLabel>

        <TraceErrorList
          trace={parsedTrace}
          errors={errors ?? []}
          performanceIssues={performanceIssues}
        />
      </Alert>
    </AlertContainer>
  );
}

function SpansInterface({event, affectedSpanIds}: Props) {
  const organization = useOrganization();
  const parsedTrace = useMemo(() => parseTrace(event), [event]);
  const waterfallModel = useMemo(
    () => new WaterfallModel(event, affectedSpanIds),
    [event, affectedSpanIds]
  );

  const handleSpanFilter = (searchQuery: string) => {
    waterfallModel.querySpanSearch(searchQuery);

    trackAnalytics('performance_views.event_details.search_query', {
      organization,
    });
  };

  return (
    <Container hasErrors={!isEmptyObject(event.errors)}>
      <QuickTraceContext.Consumer>
        {quickTrace => {
          const errors: TraceError[] | undefined =
            quickTrace?.currentEvent && !isTraceError(quickTrace?.currentEvent)
              ? quickTrace?.currentEvent?.errors
              : undefined;
          const performance_issues: TracePerformanceIssue[] | undefined =
            quickTrace?.currentEvent && !isTraceError(quickTrace?.currentEvent)
              ? quickTrace?.currentEvent?.performance_issues
              : undefined;

          return (
            <Fragment>
              <TraceErrorAlerts
                isLoading={quickTrace?.isLoading ?? false}
                errors={errors}
                performanceIssues={performance_issues}
                parsedTrace={parsedTrace}
              />
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
                        performanceIssues={performance_issues}
                        waterfallModel={waterfallModel}
                        organization={organization}
                      />
                    );
                  }}
                </Observer>
              </Panel>
            </Fragment>
          );
        }}
      </QuickTraceContext.Consumer>
    </Container>
  );
}

const Container = styled('div')<{hasErrors: boolean}>`
  ${p =>
    p.hasErrors &&
    `
  padding: ${space(2)} 0;

  @media (min-width: ${p.theme.breakpoints.sm}) {
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

export const Spans = SpansInterface;
