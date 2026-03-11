import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {getUserTimezone} from 'sentry/utils/dates';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useAttributeBreakdownComparison from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {useAttributeBreakdownsTooltipAction} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';
import {useFilteredRankedAttributes} from 'sentry/views/explore/hooks/useFilteredRankedAttributes';

import {Chart} from './cohortComparisonChart';
import {CHARTS_PER_PAGE} from './constants';
import {AttributeBreakdownsComponent} from './styles';
import {tooltipActionsHtmlRenderer} from './utils';

interface CohortComparisonProps {
  query: string;
  selection: Selection;
  yAxis: string;
  dataset?: DiscoverDatasets;
  extrapolate?: string;
}

export function CohortComparison({
  selection,
  yAxis,
  query,
  dataset,
  extrapolate,
}: CohortComparisonProps) {
  const onAction = useAttributeBreakdownsTooltipAction();

  const {data, isLoading, error} = useAttributeBreakdownComparison({
    aggregateFunction: yAxis,
    range: selection.range,
    query,
    dataset,
    extrapolate,
  });
  const [searchQuery, setSearchQuery] = useQueryParamState({
    fieldName: 'attributeBreakdownsSearch',
  });
  const theme = useTheme();

  // Debouncing the search query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery ?? '', 100);

  const {
    filteredRankedAttributes,
    paginatedAttributes,
    hasPrevious,
    hasNext,
    nextPage,
    previousPage,
  } = useFilteredRankedAttributes({
    rankedAttributes: data?.rankedAttributes,
    searchQuery: debouncedSearchQuery,
    pageSize: CHARTS_PER_PAGE,
  });

  const selectedRangeToDates = useMemo(() => {
    if (!selection) {
      return null;
    }

    const [x1, x2] = selection.range;

    let startTimestamp = Math.floor(x1 / 60_000) * 60_000;
    const endTimestamp = Math.ceil(x2 / 60_000) * 60_000;
    startTimestamp = Math.min(startTimestamp, endTimestamp - 60_000);

    const userTimezone = getUserTimezone() || moment.tz.guess();
    const start = moment.tz(startTimestamp, userTimezone).format('MMM D YYYY h:mm A z');
    const end = moment.tz(endTimestamp, userTimezone).format('MMM D YYYY h:mm A z');

    return {
      start,
      end,
    };
  }, [selection]);

  return (
    <Panel>
      <Flex direction="column" gap="2xl" padding="xl">
        <AttributeBreakdownsComponent.ControlsContainer>
          <AttributeBreakdownsComponent.StyledBaseSearchBar
            placeholder={t('Search keys')}
            onChange={value => {
              setSearchQuery(value);
            }}
            query={debouncedSearchQuery}
            size="sm"
          />
          <AttributeBreakdownsComponent.FeedbackButton />
        </AttributeBreakdownsComponent.ControlsContainer>
        {isLoading ? (
          <LoadingIndicator />
        ) : error ? (
          <AttributeBreakdownsComponent.ErrorState error={error} />
        ) : (
          <Fragment>
            {selectedRangeToDates && (
              <Stack gap="xs">
                <SelectionHint backgroundColor={theme.chart.getColorPalette(0)?.[0]}>
                  {t(
                    'Selection is data between %s - %s',
                    selectedRangeToDates.start,
                    selectedRangeToDates.end
                  )}
                </SelectionHint>
                <SelectionHint backgroundColor="#A29FAA">
                  {t('Baseline is all other spans from your query')}
                </SelectionHint>
              </Stack>
            )}
            {filteredRankedAttributes.length > 0 ? (
              <Fragment>
                <AttributeBreakdownsComponent.ChartsGrid>
                  {paginatedAttributes.map(attribute => (
                    <Chart
                      key={attribute.attributeName}
                      attribute={attribute}
                      theme={theme}
                      cohort1Total={data?.cohort1Total ?? 0}
                      cohort2Total={data?.cohort2Total ?? 0}
                      query={query}
                      actions={{
                        htmlRenderer: (value: string) =>
                          tooltipActionsHtmlRenderer(
                            value,
                            attribute.attributeName,
                            theme
                          ),
                        onAction,
                      }}
                    />
                  ))}
                </AttributeBreakdownsComponent.ChartsGrid>
                <AttributeBreakdownsComponent.Pagination
                  isNextDisabled={!hasNext}
                  isPrevDisabled={!hasPrevious}
                  onNextClick={nextPage}
                  onPrevClick={previousPage}
                />
              </Fragment>
            ) : (
              <AttributeBreakdownsComponent.EmptySearchState />
            )}
          </Fragment>
        )}
      </Flex>
    </Panel>
  );
}

const SelectionHint = styled(Text)<{backgroundColor?: string}>`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${p => p.backgroundColor || p.theme.colors.gray500};
    margin-right: ${p => p.theme.space.xs};
    flex-shrink: 0;
  }
`;
