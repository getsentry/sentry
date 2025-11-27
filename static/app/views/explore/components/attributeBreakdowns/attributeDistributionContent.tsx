import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Flex} from '@sentry/scraps/layout';

import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import BaseSearchBar from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {AttributeBreakdownsComponent} from './styles';

const CHARTS_COLUMN_COUNT = 3;
const CHARTS_PER_PAGE = CHARTS_COLUMN_COUNT * 4;

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
    isError: isAttributeBreakdownsError,
  } = useAttributeBreakdowns();

  const {
    data: cohortCountResponse,
    isLoading: isCohortCountLoading,
    isError: isCohortCountError,
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

  if (isAttributeBreakdownsError || isCohortCountError) {
    return <LoadingError message={t('Failed to load attribute breakdowns')} />;
  }

  return (
    <Panel>
      <Flex direction="column" gap="xl" padding="xl">
        <Fragment>
          <ControlsContainer>
            <StyledBaseSearchBar
              placeholder={t('Search keys')}
              onChange={q => {
                setSearchQuery(q);
              }}
              query={debouncedSearchQuery}
              size="sm"
            />
            <AttributeBreakdownsComponent.FeedbackButton />
          </ControlsContainer>
          {isAttributeBreakdownsLoading || isCohortCountLoading ? (
            <AttributeBreakdownsComponent.LoadingCharts />
          ) : filteredAttributeDistribution.length > 0 ? (
            <Fragment>
              <ChartsGrid>
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
              </ChartsGrid>
              <PaginationContainer>
                <ButtonBar merged gap="0">
                  <Button
                    icon={<IconChevron direction="left" />}
                    aria-label={t('Previous')}
                    size="sm"
                    disabled={page === 0}
                    onClick={() => {
                      setPage(page - 1);
                    }}
                  />
                  <Button
                    icon={<IconChevron direction="right" />}
                    aria-label={t('Next')}
                    size="sm"
                    disabled={
                      page ===
                      Math.ceil(
                        (filteredAttributeDistribution?.length ?? 0) / CHARTS_PER_PAGE
                      ) -
                        1
                    }
                    onClick={() => {
                      setPage(page + 1);
                    }}
                  />
                </ButtonBar>
              </PaginationContainer>
            </Fragment>
          ) : (
            <NoAttributesMessage>{t('No matching attributes found')}</NoAttributesMessage>
          )}
        </Fragment>
      </Flex>
    </Panel>
  );
}

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const StyledBaseSearchBar = styled(BaseSearchBar)`
  flex: 1;
`;

const NoAttributesMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const ChartsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(${CHARTS_COLUMN_COUNT}, 1fr);
  gap: ${space(1)};
`;

const PaginationContainer = styled('div')`
  display: flex;
  justify-content: end;
  align-items: center;
`;
