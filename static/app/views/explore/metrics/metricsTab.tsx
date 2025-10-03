import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {useSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  BottomSectionBody,
  FilterBarContainer,
  StyledPageFilterBar,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';

type LogsTabProps = PickableDays;

export function MetricsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  const searchQueryBuilderProviderProps = useSearchQueryBuilderProps({
    itemType: TraceItemDataset.TRACEMETRICS,
    numberAttributes: {},
    stringAttributes: {},
    numberSecondaryAliases: {},
    stringSecondaryAliases: {},
    initialQuery: '',
    searchSource: 'ourmetrics',
  });
  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProviderProps}>
      <TopSectionBody noRowGap>
        <Layout.Main fullWidth>
          <FilterBarContainer>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter
                defaultPeriod={defaultPeriod}
                maxPickableDays={maxPickableDays}
                relativeOptions={relativeOptions}
                searchPlaceholder={t('Custom range: 2h, 4d, 3w')}
              />
            </StyledPageFilterBar>
          </FilterBarContainer>
        </Layout.Main>
      </TopSectionBody>
      <BottomSectionBody sidebarOpen={false}>Currently in development</BottomSectionBody>
    </SearchQueryBuilderProvider>
  );
}
