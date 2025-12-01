import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Flex} from '@sentry/scraps/layout';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';
import {Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import BaseSearchBar from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUserTimezone} from 'sentry/utils/dates';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useAttributeBreakdownComparison from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';
import {useQueryParamsVisualizes} from 'sentry/views/explore/queryParams/context';

import {Chart} from './cohortComparisonChart';
import {AttributeBreakdownsComponent} from './styles';

type SortingMethod = 'rrr';

const CHARTS_COLUMN_COUNT = 3;
const CHARTS_PER_PAGE = CHARTS_COLUMN_COUNT * 4;

export function CohortComparison({
  selection,
  chartIndex,
}: {
  chartIndex: number;
  selection: Selection;
}) {
  const visualizes = useQueryParamsVisualizes();

  const yAxis = visualizes[chartIndex]?.yAxis ?? '';

  const {data, isLoading, error} = useAttributeBreakdownComparison({
    aggregateFunction: yAxis,
    range: selection.range,
  });
  const [searchQuery, setSearchQuery] = useQueryParamState({
    fieldName: 'attributeBreakdownsSearch',
  });
  const sortingMethod: SortingMethod = 'rrr';
  const [page, setPage] = useState(0);
  const theme = useTheme();

  // Debouncing the search query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  // query here to ensure smooth typing, by delaying the re-mounts a little as the user types.
  const debouncedSearchQuery = useDebouncedValue(searchQuery ?? '', 100);

  const filteredRankedAttributes = useMemo(() => {
    const attrs = data?.rankedAttributes;
    if (!attrs) {
      return [];
    }

    let filteredAttrs = attrs;
    if (debouncedSearchQuery.trim()) {
      const searchFor = debouncedSearchQuery.toLocaleLowerCase().trim();
      filteredAttrs = attrs.filter(attr =>
        attr.attributeName.toLocaleLowerCase().trim().includes(searchFor)
      );
    }

    const sortedAttrs = [...filteredAttrs].sort((a, b) => {
      const aOrder = a.order[sortingMethod];
      const bOrder = b.order[sortingMethod];

      if (aOrder === null && bOrder === null) return 0;
      if (aOrder === null) return 1;
      if (bOrder === null) return -1;

      return aOrder - bOrder;
    });

    return sortedAttrs;
  }, [debouncedSearchQuery, data?.rankedAttributes, sortingMethod]);

  useEffect(() => {
    // Ensure that we are on the first page whenever filtered attributes change.
    setPage(0);
  }, [filteredRankedAttributes]);

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
    <Panel data-explore-chart-selection-region>
      <Flex direction="column" gap="2xl" padding="xl">
        <ControlsContainer>
          <StyledBaseSearchBar
            placeholder={t('Search keys')}
            onChange={query => {
              setSearchQuery(query);
            }}
            query={debouncedSearchQuery}
            size="sm"
          />
          <AttributeBreakdownsComponent.FeedbackButton />
        </ControlsContainer>
        {isLoading ? (
          <AttributeBreakdownsComponent.LoadingCharts />
        ) : error ? (
          <AttributeBreakdownsComponent.ErrorState error={error} />
        ) : (
          <Fragment>
            {selectedRangeToDates && (
              <SelectionHintContainer>
                <SelectionHint color={theme.chart.getColorPalette(0)?.[0]}>
                  {t(
                    'Selection is data between %s - %s',
                    selectedRangeToDates.start,
                    selectedRangeToDates.end
                  )}
                </SelectionHint>
                <SelectionHint color="#A29FAA">
                  {t('Baseline is all other spans from your query')}
                </SelectionHint>
              </SelectionHintContainer>
            )}
            {filteredRankedAttributes.length > 0 ? (
              <Fragment>
                <ChartsGrid>
                  {filteredRankedAttributes
                    .slice(page * CHARTS_PER_PAGE, (page + 1) * CHARTS_PER_PAGE)
                    .map(attribute => (
                      <Chart
                        key={attribute.attributeName}
                        attribute={attribute}
                        theme={theme}
                        cohort1Total={data?.cohort1Total ?? 0}
                        cohort2Total={data?.cohort2Total ?? 0}
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
                        Math.ceil(filteredRankedAttributes.length / CHARTS_PER_PAGE) - 1
                      }
                      onClick={() => {
                        setPage(page + 1);
                      }}
                    />
                  </ButtonBar>
                </PaginationContainer>
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

const ControlsContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledBaseSearchBar = styled(BaseSearchBar)`
  flex: 1;
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

const SelectionHintContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const SelectionHint = styled(Text)<{color?: string}>`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${p => p.color || p.theme.gray400};
    margin-right: ${space(0.5)};
    flex-shrink: 0;
  }
`;
