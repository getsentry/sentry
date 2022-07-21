import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import {getDatasetConfig} from 'sentry/views/dashboardsV2/datasetConfig/base';
import ReleasesSelectControl from 'sentry/views/dashboardsV2/releasesSelectControl';
import {DashboardFilters, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';

import {BuildStep} from '../buildStep';

interface Props {
  canAddSearchConditions: boolean;
  hideLegendAlias: boolean;
  onAddSearchConditions: () => void;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
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
  queries,
  onQueryRemove,
  onAddSearchConditions,
  onQueryChange,
  organization,
  hideLegendAlias,
  queryErrors,
  widgetType,
  selection,
}: Props) {
  const blurTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleSearch = useCallback(
    (queryIndex: number) => {
      return (field: string) => {
        // SearchBar will call handlers for both onSearch and onBlur
        // when selecting a value from the autocomplete dropdown. This can
        // cause state issues for the search bar in our use case. To prevent
        // this, we set a timer in our onSearch handler to block our onBlur
        // handler from firing if it is within 200ms, ie from clicking an
        // autocomplete value.
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = window.setTimeout(() => {
          blurTimeoutRef.current = undefined;
        }, 200);

        const newQuery: WidgetQuery = {
          ...queries[queryIndex],
          conditions: field,
        };

        onQueryChange(queryIndex, newQuery);
      };
    },
    [onQueryChange, queries]
  );

  const handleBlur = useCallback(
    (queryIndex: number) => {
      return (field: string) => {
        if (!blurTimeoutRef.current) {
          const newQuery: WidgetQuery = {
            ...queries[queryIndex],
            conditions: field,
          };
          onQueryChange(queryIndex, newQuery);
        }
      };
    },
    [onQueryChange, queries]
  );

  const datasetConfig = getDatasetConfig(widgetType);

  return (
    <BuildStep
      title={t('Filter your results')}
      description={
        canAddSearchConditions
          ? t(
              'This is how you filter down your search. You can add multiple queries to compare data for each overlay.'
            )
          : t('This is how you filter down your search.')
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
              selectedReleases={dashboardFilters?.release ?? []}
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
                  onBlur={handleBlur(queryIndex)}
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
                    onClick={() => onQueryRemove(queryIndex)}
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
