import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert/alert';
import {Flex} from '@sentry/scraps/layout';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import useAttributeBreakdowns from 'sentry/views/explore/hooks/useAttributeBreakdowns';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';

import {Chart} from './attributeDistributionChart';
import {CHART_SELECTION_ALERT_KEY, CHARTS_PER_PAGE} from './constants';
import {AttributeBreakdownsComponent} from './styles';

export type AttributeDistribution = Array<{
  attributeName: string;
  values: Array<{label: string; value: number}>;
}>;

type PaginationState = {
  cursor: string | undefined;
  page: number;
};

export function AttributeDistribution() {
  const [searchQuery, setSearchQuery] = useQueryParamState({
    fieldName: 'attributeBreakdownsSearch',
  });

  // Little unconventional, but the /trace-items/stats/ endpoint but recommends fetching
  // more data than we need to display the current page. We maintain a cursor to fetch the next page,
  // and a page index to display the current page, from the accumulated data.
  const [pagination, setPagination] = useState<PaginationState>({
    cursor: undefined,
    page: 0,
  });

  const query = useQueryParamsQuery();
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
  } = useApiQuery<{data: Array<{'count()': number}>}>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...cohortCountEventView.getEventsAPIPayload(location),
          per_page: 1,
          disableAggregateExtrapolation: '1',
          sampling: SAMPLING_MODE.NORMAL,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const cohortCount: number = cohortCountResponse?.data?.[0]?.['count()'] ?? 0;

  // Debouncing the search query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery ?? '', 200);

  const {
    data: attributeBreakdownsData,
    getResponseHeader: getAttributeBreakdownsResponseHeader,
    isLoading: isAttributeBreakdownsLoading,
    error: attributeBreakdownsError,
  } = useAttributeBreakdowns({
    cursor: pagination.cursor,
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

  // Reset pagination on any query change
  useEffect(() => {
    setPagination({cursor: undefined, page: 0});
  }, [debouncedSearchQuery, selection, query]);

  const parsedLinks = parseLinkHeader(
    getAttributeBreakdownsResponseHeader?.('Link') ?? null
  );

  const uniqueAttributeDistribution: AttributeDistribution = useMemo(() => {
    if (!attributeBreakdownsData) return [];

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
      <Flex direction="column" gap="xl" padding="xl">
        <ChartSelectionAlert />
        <AttributeBreakdownsComponent.ControlsContainer>
          <AttributeBreakdownsComponent.StyledBaseSearchBar
            placeholder={t('Search keys')}
            onChange={q => {
              setSearchQuery(q);
            }}
            query={debouncedSearchQuery}
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
              {uniqueAttributeDistribution
                .slice(
                  pagination.page * CHARTS_PER_PAGE,
                  (pagination.page + 1) * CHARTS_PER_PAGE
                )
                .map(distribution => (
                  <Chart
                    key={distribution.attributeName}
                    attributeDistribution={distribution}
                    cohortCount={cohortCount}
                    theme={theme}
                  />
                ))}
            </AttributeBreakdownsComponent.ChartsGrid>
            <AttributeBreakdownsComponent.Pagination
              isPrevDisabled={pagination.page === 0}
              isNextDisabled={
                pagination.page ===
                Math.ceil(uniqueAttributeDistribution.length / CHARTS_PER_PAGE) - 1
              }
              onPrevClick={() => {
                setPagination({...pagination, page: pagination.page - 1});
              }}
              onNextClick={() => {
                if (parsedLinks.next?.results) {
                  setPagination({
                    cursor: parsedLinks.next?.cursor,
                    page: pagination.page + 1,
                  });
                } else {
                  setPagination({...pagination, page: pagination.page + 1});
                }
              }}
            />
          </Fragment>
        ) : (
          <AttributeBreakdownsComponent.EmptySearchState />
        )}
      </Flex>
    </Panel>
  );
}

function ChartSelectionAlert() {
  const {dismiss, isDismissed} = useDismissAlert({
    key: CHART_SELECTION_ALERT_KEY,
  });

  if (isDismissed) {
    return null;
  }

  return (
    <Alert type="info">
      <Flex align="center" justify="between">
        {t(
          'Drag to select a region in the chart above and see how its breakdowns differ from the baseline.'
        )}
        <IconClose size="sm" onClick={dismiss} cursor="pointer" />
      </Flex>
    </Alert>
  );
}
