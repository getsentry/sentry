import {Fragment, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Flex, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseCursor} from 'sentry/utils/cursor';
import {EventView} from 'sentry/utils/discover/eventView';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {useAttributeBreakdowns} from 'sentry/views/explore/hooks/useAttributeBreakdowns';
import {useAttributeBreakdownsTooltipAction} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useQueryParams,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';

import {Chart} from './attributeDistributionChart';
import {CHART_SELECTION_ALERT_KEY} from './constants';
import {AttributeBreakdownsComponent} from './styles';
import {tooltipActionsHtmlRenderer} from './utils';

export type AttributeDistribution = Array<{
  attributeName: string;
  values: Array<{label: string; value: number}>;
}>;

export function AttributeDistribution() {
  const {breakdownCursor, breakdownQuery, query} = useQueryParams();
  const setQueryParams = useSetQueryParams();
  const searchQuery = breakdownQuery ?? '';
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200);

  const onAction = useAttributeBreakdownsTooltipAction();

  const dataset = useSpansDataset();
  const {selection} = usePageFilters();
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

  const cohortCountEventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      name: 'Explore - Span Aggregates',
      fields: ['count()'],
      query,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, query, selection]);

  const {
    data: cohortCountResponse,
    isLoading: isCohortCountLoading,
    error: cohortCountError,
    refetch: refetchCohortCount,
  } = useQuery({
    ...apiOptions.as<{data: Array<{'count()': number}>}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          ...cohortCountEventView.getEventsAPIPayload(location),
          per_page: 1,
          disableAggregateExtrapolation: '1',
          sampling: SAMPLING_MODE.NORMAL,
        },
        staleTime: Infinity,
      }
    ),
    select: selectJsonWithHeaders,
  });

  const cohortCount = cohortCountResponse?.json?.data?.[0]?.['count()'] ?? 0;

  const {
    data: attributeBreakdownsData,
    pageLinks: attributeBreakdownsPageLinks,
    isLoading: isAttributeBreakdownsLoading,
    error: attributeBreakdownsError,
  } = useAttributeBreakdowns({
    cursor: breakdownCursor,
    substringMatch: debouncedSearchQuery,
  });

  // Refetch the cohort count when the attributeBreakdownsData changes
  // This ensures that the population percentages are calculated correctly,
  // for none absolute date ranges.
  useEffect(() => {
    if (!isAttributeBreakdownsLoading && attributeBreakdownsData) {
      refetchCohortCount();
    }
  }, [attributeBreakdownsData, isAttributeBreakdownsLoading, refetchCohortCount]);

  const parsedLinks = parseLinkHeader(attributeBreakdownsPageLinks);

  const uniqueAttributeDistribution = useMemo(() => {
    if (!attributeBreakdownsData) {
      return [];
    }

    const seen = new Set<string>();
    const filtered = Object.entries(
      attributeBreakdownsData
    ).reduce<AttributeDistribution>((acc, [name, values]) => {
      const prettyName = prettifyAttributeName(name);
      const normalizedName = prettyName.toLocaleLowerCase().trim();
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        acc.push({
          attributeName: prettyName,
          values,
        });
      }
      return acc;
    }, []);

    return filtered;
  }, [attributeBreakdownsData]);

  const error = attributeBreakdownsError ?? cohortCountError;

  return (
    <Panel>
      <Stack gap="xl" padding="xl">
        <ChartSelectionAlert />
        <AttributeBreakdownsComponent.ControlsContainer>
          <AttributeBreakdownsComponent.StyledBaseSearchBar
            placeholder={t('Search keys')}
            onChange={value => {
              setQueryParams({
                breakdownQuery: value,
                breakdownCursor: null,
              });
            }}
            query={searchQuery}
            size="sm"
          />
          <AttributeBreakdownsComponent.FeedbackButton />
        </AttributeBreakdownsComponent.ControlsContainer>
        {isAttributeBreakdownsLoading || isCohortCountLoading ? (
          <LoadingIndicator />
        ) : error ? (
          <AttributeBreakdownsComponent.ErrorState error={error} />
        ) : uniqueAttributeDistribution.length > 0 ? (
          <Fragment>
            <AttributeBreakdownsComponent.ChartsGrid>
              {uniqueAttributeDistribution.map(distribution => (
                <Chart
                  key={distribution.attributeName}
                  attributeDistribution={distribution}
                  cohortCount={cohortCount}
                  theme={theme}
                  query={query}
                  actions={{
                    htmlRenderer: (value: string) =>
                      tooltipActionsHtmlRenderer(
                        value,
                        distribution.attributeName,
                        theme
                      ),
                    onAction,
                  }}
                />
              ))}
            </AttributeBreakdownsComponent.ChartsGrid>
            <AttributeBreakdownsComponent.Pagination
              isPrevDisabled={!parsedLinks.previous?.results}
              isNextDisabled={!parsedLinks.next?.results}
              onPrevClick={() => {
                setQueryParams({
                  breakdownCursor: getPreviousBreakdownCursor(
                    parsedLinks.previous?.cursor
                  ),
                });
              }}
              onNextClick={() => {
                setQueryParams({
                  breakdownCursor: parsedLinks.next?.cursor,
                });
              }}
            />
          </Fragment>
        ) : (
          <AttributeBreakdownsComponent.EmptySearchState />
        )}
      </Stack>
    </Panel>
  );
}

function getPreviousBreakdownCursor(cursor: string | undefined) {
  const parsedCursor = parseCursor(cursor);

  return parsedCursor?.isPrev && parsedCursor.offset === 0 ? null : cursor;
}

function ChartSelectionAlert() {
  const {dismiss, isDismissed} = useDismissAlert({
    key: CHART_SELECTION_ALERT_KEY,
  });

  if (isDismissed) {
    return null;
  }

  return (
    <Alert variant="info">
      <Flex align="center" justify="between">
        {t(
          'Drag to select a region in the chart above and see how its breakdowns differ from the baseline.'
        )}
        <IconClose size="sm" onClick={dismiss} cursor="pointer" />
      </Flex>
    </Alert>
  );
}
