import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';

import {BuildStep} from './buildStep';

interface Props {
  blurTimeout: number | null;
  canAddSearchConditions: boolean;
  hideLegendAlias: boolean;
  onAddSearchConditions: () => void;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  onQueryRemove: (queryIndex: number) => void;
  onSetBlurTimeout: (blurTimeout: number | null) => void;
  organization: Organization;
  queries: WidgetQuery[];
  projectIds?: number[] | readonly number[];
  queryErrors?: Record<string, any>[];
}

export function FilterResultsStep({
  canAddSearchConditions,
  organization,
  queries,
  blurTimeout,
  onSetBlurTimeout,
  onQueryRemove,
  onAddSearchConditions,
  onQueryChange,
  hideLegendAlias,
  projectIds,
  queryErrors,
}: Props) {
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
                <Search
                  searchSource="widget_builder"
                  organization={organization}
                  projectIds={projectIds}
                  query={query.conditions}
                  fields={[]}
                  onSearch={field => {
                    // SearchBar will call handlers for both onSearch and onBlur
                    // when selecting a value from the autocomplete dropdown. This can
                    // cause state issues for the search bar in our use case. To prevent
                    // this, we set a timer in our onSearch handler to block our onBlur
                    // handler from firing if it is within 200ms, ie from clicking an
                    // autocomplete value.
                    onSetBlurTimeout(
                      window.setTimeout(() => {
                        onSetBlurTimeout(null);
                      }, 200)
                    );

                    const newQuery: WidgetQuery = {
                      ...queries[queryIndex],
                      conditions: field,
                    };
                    onQueryChange(queryIndex, newQuery);
                  }}
                  onBlur={field => {
                    if (!blurTimeout) {
                      const newQuery: WidgetQuery = {
                        ...queries[queryIndex],
                        conditions: field,
                      };
                      onQueryChange(queryIndex, newQuery);
                    }
                  }}
                  useFormWrapper={false}
                  maxQueryLength={MAX_QUERY_LENGTH}
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
          <Button
            size="small"
            icon={<IconAdd isCircled />}
            onClick={onAddSearchConditions}
          >
            {t('Add query')}
          </Button>
        )}
      </div>
    </BuildStep>
  );
}

const Search = styled(SearchBar)`
  flex-grow: 1;
`;

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
