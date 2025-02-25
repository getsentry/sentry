import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {OnDemandWarningIcon} from 'sentry/components/alerts/onDemandMetricAlert';
import {Button} from 'sentry/components/button';
import {Input} from 'sentry/components/core/input';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {
  createOnDemandFilterWarning,
  isOnDemandQueryString,
  shouldDisplayOnDemandWidgetWarning,
} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';
import {
  DashboardFilterKeys,
  type DashboardFilters,
  OnDemandExtractionState,
  type ValidateWidgetResponse,
  type WidgetQuery,
  type WidgetType,
} from 'sentry/views/dashboards/types';
import {getDiscoverDatasetFromWidgetType} from 'sentry/views/dashboards/widgetBuilder/utils';

import {BuildStep, SubHeading} from '../buildStep';

interface Props {
  canAddSearchConditions: boolean;
  hideLegendAlias: boolean;
  location: Location;
  onAddSearchConditions: () => void;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  onQueryConditionChange: (isQueryConditionValid: boolean) => void;
  onQueryRemove: (queryIndex: number) => void;
  queries: WidgetQuery[];
  selection: PageFilters;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
  widgetType: WidgetType;
  dashboardFilters?: DashboardFilters;
  projectIds?: number[] | readonly number[];
  queryErrors?: Array<Record<string, any>>;
}

export function FilterResultsStep({
  canAddSearchConditions,
  dashboardFilters,
  location,
  queries,
  onQueryRemove,
  onAddSearchConditions,
  onQueryChange,
  hideLegendAlias,
  queryErrors,
  widgetType,
  selection,
  onQueryConditionChange,
  validatedWidgetResponse,
}: Props) {
  const organization = useOrganization();
  const [queryConditionValidity, setQueryConditionValidity] = useState<boolean[]>([]);

  const handleSearch = useCallback(
    (queryIndex: number) => {
      return (field: string) => {
        const newQuery: WidgetQuery = {
          ...queries[queryIndex]!,
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
          ...queries[queryIndex]!,
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
                    shouldDisplayOnDemandWidgetWarning(query, widgetType, organization)
                      ? getOnDemandFilterWarning
                      : undefined
                  }
                  pageFilters={selection}
                  onClose={handleClose(queryIndex)}
                  onSearch={handleSearch(queryIndex)}
                  widgetQuery={query}
                  dataset={getDiscoverDatasetFromWidgetType(widgetType)}
                />
                {shouldDisplayOnDemandWidgetWarning(query, widgetType, organization) && (
                  <WidgetOnDemandQueryWarning
                    query={query}
                    validatedWidgetResponse={validatedWidgetResponse}
                    queryIndex={queryIndex}
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
                        ...queries[queryIndex]!,
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

export function WidgetOnDemandQueryWarning(props: {
  query: WidgetQuery;
  queryIndex: number;
  validatedWidgetResponse: Props['validatedWidgetResponse'];
}) {
  const organization = useOrganization();
  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return null;
  }
  if (!isOnDemandQueryString(props.query.conditions)) {
    return null;
  }

  if (
    props.validatedWidgetResponse?.data?.warnings?.queries?.[props.queryIndex] ===
    OnDemandExtractionState.DISABLED_SPEC_LIMIT
  ) {
    return (
      <OnDemandWarningIcon
        msg={tct(
          'We don’t routinely collect metrics for this property and you’ve exceeded the maximum number of extracted metrics for your organization. [strong:Please review your other widgets and remove any unused or less valuable queries marked with a (!) sign.]',
          {strong: <strong />}
        )}
        color="yellow300"
      />
    );
  }

  return (
    <OnDemandWarningIcon
      msg={tct(
        'We don’t routinely collect metrics from this property. However, we’ll do so [strong:once this widget has been saved.]',
        {strong: <strong />}
      )}
      color={
        organization.features.includes('dashboards-widget-builder-redesign')
          ? 'yellow300'
          : undefined
      }
    />
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
