import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';
import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import Panel from 'sentry/components/panels/panel';
import {IconChevron} from 'sentry/icons';
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

  const [cursor, setCursor] = useState<string | undefined>(undefined);
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
      staleTime: 0,
    }
  );

  const cohortCount: number = cohortCountResponse?.data?.[0]?.['count()'] ?? 0;

  // Debouncing the search query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery ?? '', 100);

  const {
    data: attributeBreakdownsData,
    getResponseHeader: getAttributeBreakdownsResponseHeader,
    isLoading: isAttributeBreakdownsLoading,
    error: attributeBreakdownsError,
  } = useAttributeBreakdowns({cursor, substringMatch: debouncedSearchQuery});

  const parsedLinks = parseLinkHeader(
    getAttributeBreakdownsResponseHeader?.('Link') ?? null
  );

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

    return filtered;
  }, [attributeBreakdownsData, debouncedSearchQuery]);

  useEffect(() => {
    setCursor(undefined);
    setPage(0);
  }, [searchQuery]);

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
                    Math.ceil(filteredAttributeDistribution.length / CHARTS_PER_PAGE) - 1
                  }
                  onClick={() => {
                    if (parsedLinks.next?.results) {
                      setCursor(parsedLinks.next?.cursor);
                    }

                    setPage(page + 1);
                  }}
                />
              </ButtonBar>
            </PaginationContainer>
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
    key: 'attribute-breakdowns-chart-selection-alert-dismissed',
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

const PaginationContainer = styled(Flex)`
  justify-content: end;
`;
