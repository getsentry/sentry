import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import Field from 'sentry/components/forms/field';
import Input from 'sentry/components/input';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {decodeList} from 'sentry/utils/queryString';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import {getDatasetConfig} from 'sentry/views/dashboardsV2/datasetConfig/base';
import ReleasesSelectControl from 'sentry/views/dashboardsV2/releasesSelectControl';
import {
  DashboardFilterKeys,
  DashboardFilters,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';

import {BuildStep} from '../buildStep';

interface Props {
  canAddSearchConditions: boolean;
  hideLegendAlias: boolean;
  location: Location;
  onAddSearchConditions: () => void;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  onQueryConditionChange: (isQueryConditionValid: boolean) => void;
  onQueryRemove: (queryIndex: number) => void;
  organization: Organization;
  queries: WidgetQuery[];
  selection: PageFilters;
  widgetType: WidgetType;
  dashboardFilters?: DashboardFilters;
  projectIds?: number[] | readonly number[];
  queryErrors?: Record<string, any>[];
}

export function FilterResultsStep({
  canAddSearchConditions,
  dashboardFilters,
  location,
  queries,
  onQueryRemove,
  onAddSearchConditions,
  onQueryChange,
  organization,
  hideLegendAlias,
  queryErrors,
  widgetType,
  selection,
  onQueryConditionChange,
}: Props) {
  const [queryConditionValidity, setQueryConditionValidity] = useState<boolean[]>([]);

  const handleSearch = useCallback(
    (queryIndex: number) => {
      return (field: string) => {
        const newQuery: WidgetQuery = {
          ...queries[queryIndex],
          conditions: field,
        };

        onQueryChange(queryIndex, newQuery);
      };
    },
    [onQueryChange, queries]
  );

  const handleClose = useCallback(
    (queryIndex: number) => {
      return (field: string, {validSearch}: {validSearch: boolean}) => {
        queryConditionValidity[queryIndex] = validSearch;
        setQueryConditionValidity(queryConditionValidity);
        onQueryConditionChange(!queryConditionValidity.some(validity => !validity));
        const newQuery: WidgetQuery = {
          ...queries[queryIndex],
          conditions: field,
        };
        onQueryChange(queryIndex, newQuery);
      };
    },
    [onQueryChange, onQueryConditionChange, queryConditionValidity, queries]
  );

  const handleRemove = (queryIndex: number) => () => {
    queryConditionValidity.splice(queryIndex, 1);
    setQueryConditionValidity(queryConditionValidity);
    onQueryConditionChange(!queryConditionValidity.some(validity => !validity));
    onQueryRemove(queryIndex);
  };

  const datasetConfig = getDatasetConfig(widgetType);

  return (
    <BuildStep
      title={t('Filter your results')}
      description={
        canAddSearchConditions
          ? t(
              'Projects, environments, and date range have been preselected at the dashboard level. Filter down your search here. You can add multiple queries to compare data for each overlay.'
            )
          : t(
              'Projects, environments, and date range have been preselected at the dashboard level. Filter down your search here.'
            )
      }
    >
      <Feature features={['dashboards-top-level-filter']}>
        <StyledPageFilterBar>
          <ProjectPageFilter disabled />
          <EnvironmentPageFilter disabled />
          <DatePageFilter alignDropdown="left" disabled />
        </StyledPageFilterBar>
        <FilterButtons>
          <ReleasesProvider organization={organization} selection={selection}>
            <StyledReleasesSelectControl
              selectedReleases={
                (DashboardFilterKeys.RELEASE in location.query
                  ? decodeList(location.query[DashboardFilterKeys.RELEASE])
                  : dashboardFilters?.[DashboardFilterKeys.RELEASE]) ?? []
              }
              isDisabled
              className="widget-release-select"
            />
          </ReleasesProvider>
        </FilterButtons>
      </Feature>
      <div>
        {queries.map((query, queryIndex) => {
          return (
            <QueryField
              key={queryIndex}
              inline={false}
              flexibleControlStateSize
              stacked
              error={queryErrors?.[queryIndex]?.conditions}
            >
              <SearchConditionsWrapper>
                <datasetConfig.SearchBar
                  organization={organization}
                  pageFilters={selection}
                  onClose={handleClose(queryIndex)}
                  onSearch={handleSearch(queryIndex)}
                  widgetQuery={query}
                />
                {!hideLegendAlias && (
                  <LegendAliasInput
                    type="text"
                    name="name"
                    value={query.name}
                    placeholder={t('Legend Alias')}
                    onChange={event => {
                      const newQuery: WidgetQuery = {
                        ...queries[queryIndex],
                        name: event.target.value,
                      };
                      onQueryChange(queryIndex, newQuery);
                    }}
                  />
                )}
                {queries.length > 1 && (
                  <Button
                    size="zero"
                    borderless
                    onClick={handleRemove(queryIndex)}
                    icon={<IconDelete />}
                    title={t('Remove query')}
                    aria-label={t('Remove query')}
                  />
                )}
              </SearchConditionsWrapper>
            </QueryField>
          );
        })}
        {canAddSearchConditions && (
          <Button size="sm" icon={<IconAdd isCircled />} onClick={onAddSearchConditions}>
            {t('Add Query')}
          </Button>
        )}
      </div>
    </BuildStep>
  );
}

const LegendAliasInput = styled(Input)`
  width: 33%;
`;

const QueryField = styled(Field)`
  padding-bottom: ${space(1)};
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
  margin-right: ${space(2)};
`;

const FilterButtons = styled(ButtonBar)`
  grid-template-columns: 1fr;

  margin-bottom: ${space(1)};
  margin-right: ${space(2)};

  justify-content: space-between;
`;

const StyledReleasesSelectControl = styled(ReleasesSelectControl)`
  button {
    width: 100%;
  }
`;

const SearchConditionsWrapper = styled('div')`
  display: flex;
  align-items: center;

  > * + * {
    margin-left: ${space(1)};
  }
`;
