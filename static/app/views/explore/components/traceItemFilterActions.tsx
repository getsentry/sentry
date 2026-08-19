import {memo, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {Text} from '@sentry/scraps/text';

import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {
  FilterType,
  filterTypeConfig,
  negationOperators,
  parseSearch,
  TermOperator,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {traceItemAttributeValuesQueryOptions} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export interface SearchFilter {
  key: string;
  op: TermOperator;
  value: string | number | boolean;
}

export function addSearchFilterToQuery(
  currentQuery: string,
  filter: SearchFilter
): string {
  const search = new MutableSearch(currentQuery);
  const value = String(filter.value);
  const isNegated = negationOperators.includes(filter.op);
  const key = isNegated ? `!${filter.key}` : filter.key;

  const addFilter = (target: MutableSearch) => {
    switch (filter.op) {
      case TermOperator.CONTAINS:
      case TermOperator.DOES_NOT_CONTAIN:
        target.addContainsFilterValue(key, value);
        break;
      case TermOperator.STARTS_WITH:
      case TermOperator.DOES_NOT_START_WITH:
        target.addStartsWithFilterValue(key, value);
        break;
      case TermOperator.ENDS_WITH:
      case TermOperator.DOES_NOT_END_WITH:
        target.addEndsWithFilterValue(key, value);
        break;
      case TermOperator.NOT_EQUAL:
      case TermOperator.DEFAULT:
        target.addFilterValue(key, value);
        break;
      default:
        target.addFilterValue(key, `${filter.op}${value}`, false);
    }
  };

  const normalizedFilter = new MutableSearch('');
  addFilter(normalizedFilter);
  const normalizedToken = normalizedFilter.tokens[0];
  if (
    normalizedToken &&
    search.tokens.some(
      token =>
        token.type === normalizedToken.type &&
        token.key === normalizedToken.key &&
        token.value === normalizedToken.value
    )
  ) {
    return currentQuery;
  }

  addFilter(search);
  return search.formatString();
}

export function getFilterRows(query: string): string[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const tokens = parseSearch(trimmedQuery);
  if (
    !tokens ||
    tokens.some(token => token.type !== Token.FILTER && token.type !== Token.SPACES)
  ) {
    return [trimmedQuery];
  }

  return tokens.flatMap(token => (token.type === Token.FILTER ? [token.text] : []));
}

const BOOLEAN_FILTER_VALUES = ['true', 'false'] as const;

const FILTER_OPERATORS = {
  boolean: filterTypeConfig[FilterType.BOOLEAN].validOps,
  string: filterTypeConfig[FilterType.TEXT].validOps,
} as const;

interface TraceItemFilterActionsProps {
  addSearchFilter: (filter: SearchFilter) => void;
  booleanAttributes: TagCollection;
  id: string;
  stringAttributes: TagCollection;
  traceItemType: TraceItemDataset;
  actionPanelOrder?: number;
}

function TraceItemFilterActionsComponent({
  addSearchFilter,
  actionPanelOrder,
  booleanAttributes,
  id,
  stringAttributes,
  traceItemType,
}: TraceItemFilterActionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const sortedStringAttributes = useMemo(
    () => orderBy(Object.values(stringAttributes), ['key']),
    [stringAttributes]
  );
  const sortedBooleanAttributes = useMemo(
    () => orderBy(Object.values(booleanAttributes), ['key']),
    [booleanAttributes]
  );
  const makeValueAction = (tag: Tag, operator: TermOperator, value: string) => {
    return {
      display: {label: value},
      onAction: () => addSearchFilter({key: tag.key, op: operator, value}),
    };
  };

  const renderAttribute = (tag: Tag, type: 'boolean' | 'string') => {
    const operators = FILTER_OPERATORS[type];

    return (
      <CMDKAction
        key={`${type}-${tag.key}`}
        display={{
          label: tag.name ?? tag.key,
          trailingItem: <TypeBadge kind={tag.kind} />,
        }}
        keywords={[tag.key]}
        prompt={t('Search for operator')}
      >
        <CMDKAction display={{label: t('Operator')}}>
          {operators.map(operator => {
            const display = {label: OP_LABELS[operator]};

            if (type === 'boolean') {
              return (
                <CMDKAction
                  key={operator || 'is'}
                  display={display}
                  prompt={t('Search for value')}
                >
                  <CMDKAction display={{label: t('Value')}}>
                    {BOOLEAN_FILTER_VALUES.map(value => (
                      <CMDKAction
                        key={value}
                        {...makeValueAction(tag, operator, value)}
                      />
                    ))}
                  </CMDKAction>
                </CMDKAction>
              );
            }

            return (
              <CMDKAction
                key={operator || 'is'}
                display={display}
                prompt={t('Search for value')}
                resource={(query, context) => {
                  const options = traceItemAttributeValuesQueryOptions({
                    datetime: selection.datetime,
                    organizationSlug: organization.slug,
                    projectIds: selection.projects,
                    searchQuery: query,
                    tagKey: tag.key,
                    traceItemType,
                    type: 'string',
                  });

                  return cmdkQueryOptions({
                    ...options,
                    select: response => {
                      const actions = response.json.flatMap(item =>
                        item.value === null
                          ? []
                          : [makeValueAction(tag, operator, item.value)]
                      );
                      return actions.length > 0
                        ? [{display: {label: t('Value')}, actions}]
                        : [];
                    },
                    enabled: context.state === 'selected',
                  });
                }}
              />
            );
          })}
        </CMDKAction>
      </CMDKAction>
    );
  };

  return (
    <CMDKAction
      id={id}
      actionContext="filter"
      actionPanel={{
        context: 'filter',
        label: t('Add Filter By'),
        order: actionPanelOrder,
      }}
      display={{label: t('Add Filter By')}}
      keywords={['add', 'search', 'filter', 'narrow', 'where', 'show']}
      prompt={t('Search for attribute')}
    >
      {sortedStringAttributes.length + sortedBooleanAttributes.length > 0 && (
        <CMDKAction display={{label: t('Attribute')}}>
          {sortedStringAttributes.map(tag => renderAttribute(tag, 'string'))}
          {sortedBooleanAttributes.map(tag => renderAttribute(tag, 'boolean'))}
        </CMDKAction>
      )}
    </CMDKAction>
  );
}

export const TraceItemFilterActions = memo(TraceItemFilterActionsComponent);

function TraceItemFilterRowsComponent({
  summary,
  targetAction,
}: {
  summary: string;
  targetAction: string;
}) {
  const filters = getFilterRows(summary);
  const rows = filters.length > 0 ? filters : [''];

  return rows.map((filter, index) => (
    <CMDKAction
      key={`${filter}-${index}`}
      actionContext={`filter:${index}`}
      display={{
        label: t('Filter By'),
        trailingItem: <QueryValue value={filter} />,
      }}
      keywords={['search', 'filter', 'narrow', 'where', 'show', filter]}
      targetAction={targetAction}
    />
  ));
}

export const TraceItemFilterRows = memo(TraceItemFilterRowsComponent);

function QueryValue({value}: {value: string}) {
  return (
    <Text size="sm" variant={value ? 'accent' : 'muted'} ellipsis>
      {value || t('None')}
    </Text>
  );
}
