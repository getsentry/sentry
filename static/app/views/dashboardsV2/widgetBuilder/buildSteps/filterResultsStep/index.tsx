import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';

import {BuildStep} from '../buildStep';

import {EventsSearchBar} from './eventsSearchBar';
import {IssuesSearchBar} from './issuesSearchBar';
import {ReleaseSearchBar} from './releaseSearchBar';

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
  projectIds?: number[] | readonly number[];
  queryErrors?: Record<string, any>[];
}

export function FilterResultsStep({
  canAddSearchConditions,
  queries,
  onQueryRemove,
  onAddSearchConditions,
  onQueryChange,
  organization,
  hideLegendAlias,
  projectIds,
  queryErrors,
  widgetType,
  selection,
}: Props) {
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback((queryIndex: number) => {
    return (field: string) => {
      // SearchBar will call handlers for both onSearch and onBlur
      // when selecting a value from the autocomplete dropdown. This can
      // cause state issues for the search bar in our use case. To prevent
      // this, we set a timer in our onSearch handler to block our onBlur
      // handler from firing if it is within 200ms, ie from clicking an
      // autocomplete value.
      blurTimeoutRef.current = window.setTimeout(() => {
        blurTimeoutRef.current = null;
      }, 200);

      const newQuery: WidgetQuery = {
        ...queries[queryIndex],
        conditions: field,
      };

      onQueryChange(queryIndex, newQuery);
    };
  }, []);

  const handleBlur = useCallback((queryIndex: number) => {
    return (field: string) => {
      if (!blurTimeoutRef.current) {
        const newQuery: WidgetQuery = {
          ...queries[queryIndex],
          conditions: field,
        };
        onQueryChange(queryIndex, newQuery);
      }
    };
  }, []);

  return (
    <BuildStep
      title={t('Filter your results')}
      description={
        canAddSearchConditions
          ? t(
              'This is how you filter down your search. You can add multiple queries to compare data.'
            )
          : t('This is how you filter down your search.')
      }
    >
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
                {widgetType === WidgetType.ISSUE ? (
                  <IssuesSearchBar
                    organization={organization}
                    query={query}
                    onBlur={handleBlur(queryIndex)}
                    onSearch={handleSearch(queryIndex)}
                    selection={selection}
                    searchSource="widget_builder"
                  />
                ) : widgetType === WidgetType.DISCOVER ? (
                  <EventsSearchBar
                    organization={organization}
                    query={query}
                    projectIds={projectIds}
                    onBlur={handleBlur(queryIndex)}
                    onSearch={handleSearch(queryIndex)}
                  />
                ) : (
                  <ReleaseSearchBar
                    organization={organization}
                    query={query}
                    projectIds={projectIds}
                    onBlur={handleBlur(queryIndex)}
                    onSearch={handleSearch(queryIndex)}
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
          <Button
            size="small"
            icon={<IconAdd isCircled />}
            onClick={onAddSearchConditions}
          >
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

const SearchConditionsWrapper = styled('div')`
  display: flex;
  align-items: center;

  > * + * {
    margin-left: ${space(1)};
  }
`;
