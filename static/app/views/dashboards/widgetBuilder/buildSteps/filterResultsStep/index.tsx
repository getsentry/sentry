import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {OnDemandWarningIcon} from 'sentry/components/alerts/onDemandMetricAlert';
import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Input from 'sentry/components/input';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {
  createOnDemandFilterWarning,
  isOnDemandQueryString,
} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {decodeList} from 'sentry/utils/queryString';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';
import {
  DashboardFilterKeys,
  DashboardFilters,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboards/types';

import {BuildStep, SubHeading} from '../buildStep';

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

  const getOnDemandFilterWarning = createOnDemandFilterWarning(
    tct(
      'We don’t routinely collect metrics from this property. However, we’ll do so [strong:once this widget has been saved.]',
      {
        strong: <strong />,
      }
    )
  );
  const shouldDisplayOnDemandWarning =
    hasOnDemandMetricWidgetFeature(organization) && widgetType === WidgetType.DISCOVER;

  return (
    <BuildStep
      title={t('Filter your results')}
      description={tct(
        'Projects, environments, date range and releases have been preselected in the dashboard that this widget belongs to. You can filter the results by these fields further using the search bar. For example, typing [releaseQuery] narrows down the results specific to that release.',
        {
          releaseQuery: <StyledReleaseQuery>release:1.0.0</StyledReleaseQuery>,
        }
      )}
    >
      <StyledPageFilterBar>
        <ProjectPageFilter disabled />
        <EnvironmentPageFilter disabled />
        <DatePageFilter disabled />
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
      </StyledPageFilterBar>
      <SubHeading>
        {canAddSearchConditions
          ? t(
              'Filter down your search here. You can add multiple queries to compare data for each overlay:'
            )
          : t('Filter down your search here:')}
      </SubHeading>
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
                  getFilterWarning={
                    shouldDisplayOnDemandWarning ? getOnDemandFilterWarning : undefined
                  }
                  organization={organization}
                  pageFilters={selection}
                  onClose={handleClose(queryIndex)}
                  onSearch={handleSearch(queryIndex)}
                  widgetQuery={query}
                />
                {shouldDisplayOnDemandWarning &&
                  isOnDemandQueryString(query.conditions) && (
                    <OnDemandWarningIcon
                      msg={tct(
                        'We don’t routinely collect metrics from this property. However, we’ll do so [strong:once this widget has been saved.]',
                        {strong: <strong />}
                      )}
                    />
                  )}
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

const QueryField = styled(FieldGroup)`
  padding-bottom: ${space(1)};
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
  margin-right: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    height: auto;
  }
`;

const StyledReleasesSelectControl = styled(ReleasesSelectControl)`
  width: 100%;

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

const StyledReleaseQuery = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.pink300};
`;
