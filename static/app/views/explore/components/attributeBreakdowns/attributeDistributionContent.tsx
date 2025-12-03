import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert/alert';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text/text';

import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import useAttributeBreakdowns from 'sentry/views/explore/hooks/useAttributeBreakdowns';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';

import {Chart} from './attributeDistributionChart';
import {CHARTS_PER_PAGE} from './constants';
import {AttributeBreakdownsComponent} from './styles';

export type AttributeDistribution = Array<{
  name: string;
  values: Array<{label: string; value: number}>;
}>;

export function AttributeDistribution() {
  const [searchQuery, setSearchQuery] = useQueryParamState({
    fieldName: 'attributeBreakdownsSearch',
  });
  const [page, setPage] = useState(0);

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
    data: attributeBreakdownsData,
    isLoading: isAttributeBreakdownsLoading,
    error: attributeBreakdownsError,
  } = useAttributeBreakdowns();

  const {
    data: cohortCountResponse,
    isLoading: isCohortCountLoading,
    error: cohortCountError,
  } = useApiQuery<{data: Array<{'count()': number}>}>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...cohortCountEventView.getEventsAPIPayload(location),
          per_page: 1,
        },
      },
    ],
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    }
  );

  const cohortCount: number = cohortCountResponse?.data?.[0]?.['count()'] ?? 0;

  // Debouncing the search query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery ?? '', 100);

  const filteredAttributeDistribution: AttributeDistribution = useMemo(() => {
    const attributeDistribution =
      attributeBreakdownsData?.data[0]?.attribute_distributions.data;
    if (!attributeDistribution) return [];

    const seen = new Set<string>();
    const searchFor = debouncedSearchQuery.trim().toLocaleLowerCase();

    const filtered = Object.entries(attributeDistribution).reduce<AttributeDistribution>(
      (acc, [name, values]) => {
        const prettyName = prettifyAttributeName(name);
        const normalizedName = prettyName.toLocaleLowerCase().trim();
        if (normalizedName.includes(searchFor) && !seen.has(normalizedName)) {
          seen.add(normalizedName);
          acc.push({
            name: prettyName,
            values,
          });
        }
        return acc;
      },
      []
    );

    // We sort the attributes by descending population density
    //  (i.e. the number of spans with the attribute populated / total number of spans)
    filtered.sort((a, b) => {
      const sumA = a.values.reduce(
        (sum, v) => sum + (typeof v.value === 'number' ? v.value : 0),
        0
      );
      const sumB = b.values.reduce(
        (sum, v) => sum + (typeof v.value === 'number' ? v.value : 0),
        0
      );
      const ratioA = cohortCount > 0 ? sumA / cohortCount : 0;
      const ratioB = cohortCount > 0 ? sumB / cohortCount : 0;
      return ratioB - ratioA;
    });

    return filtered;
  }, [attributeBreakdownsData, debouncedSearchQuery, cohortCount]);

  useEffect(() => {
    // Ensure that we are on the first page whenever filtered attributes change.
    setPage(0);
  }, [filteredAttributeDistribution]);

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
          <AttributeBreakdownsComponent.LoadingCharts />
        ) : error ? (
          <AttributeBreakdownsComponent.ErrorState error={error} />
        ) : filteredAttributeDistribution.length > 0 ? (
          <Fragment>
            <AttributeBreakdownsComponent.ChartsGrid>
              {filteredAttributeDistribution
                .slice(page * CHARTS_PER_PAGE, (page + 1) * CHARTS_PER_PAGE)
                .map(attribute => (
                  <Chart
                    key={attribute.name}
                    attributeDistribution={attribute}
                    cohortCount={cohortCount}
                    theme={theme}
                  />
                ))}
            </AttributeBreakdownsComponent.ChartsGrid>
            <AttributeBreakdownsComponent.Pagination
              currentPage={page}
              onPageChange={setPage}
              totalItems={filteredAttributeDistribution?.length ?? 0}
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
  return (
    <Alert type="info">
      <Text>
        {t(
          'Drag to select a region in the chart above and see how its breakdowns differ from the baseline.'
        )}
      </Text>
    </Alert>
  );
}
