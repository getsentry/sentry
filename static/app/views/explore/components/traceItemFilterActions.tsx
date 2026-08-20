import {Fragment, memo, useMemo} from 'react';
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
import {MutableSearch, TokenType} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {traceItemAttributeValuesQueryOptions} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export interface SearchFilter {
  key: string;
  op: TermOperator;
  value: string | number | boolean;
}

function normalizeFilterValue(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return value;
  }

  try {
    return Array.isArray(JSON.parse(trimmedValue)) ? JSON.stringify(value) : value;
  } catch {
    return value;
  }
}

export function addSearchFilterToQuery(
  currentQuery: string,
  filter: SearchFilter
): string {
  const value = normalizeFilterValue(String(filter.value));
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
  const normalizedFilterText = normalizedFilter.formatString();
  if (getFilterRows(currentQuery).includes(normalizedFilterText)) {
    return currentQuery;
  }

  return [currentQuery.trim(), normalizedFilterText].filter(Boolean).join(' ');
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
    // MutableSearch can recover UI-generated filters with bracketed JSON values that
    // the search syntax parser treats as complex syntax.
    const legacySearch = new MutableSearch(trimmedQuery);
    const legacyFilterTypes = new Set([
      TokenType.FILTER,
      TokenType.CONTAINS_FILTER,
      TokenType.STARTS_WITH_FILTER,
      TokenType.ENDS_WITH_FILTER,
    ]);

    if (
      legacySearch.tokens.length > 0 &&
      legacySearch.tokens.every(token => legacyFilterTypes.has(token.type))
    ) {
      return legacySearch.tokens.map(token => {
        const row = new MutableSearch('');
        row.tokens = [token];
        return row.formatString();
      });
    }

    return [trimmedQuery];
  }

  return tokens.flatMap(token => (token.type === Token.FILTER ? [token.text] : []));
}

export function removeSearchFilterFromQuery(query: string, filterIndex: number): string {
  return getFilterRows(query)
    .filter((_, index) => index !== filterIndex)
    .join(' ');
}

export function replaceSearchFilterInQuery(
  query: string,
  filterIndex: number,
  filter: SearchFilter
): string {
  const filters = getFilterRows(query);
  if (filterIndex < 0 || filterIndex >= filters.length) {
    return query;
  }

  filters[filterIndex] = addSearchFilterToQuery('', filter);
  return filters.join(' ');
}

export function getSearchFilterAttribute(query: string): string | null {
  return getSearchFilterDescriptor(query)?.attributeKey ?? null;
}

export function getSearchFilterDescriptor(
  query: string
): {attributeKey: string; operator: TermOperator; value: string} | null {
  const tokens = parseSearch(query);
  const filters = tokens?.filter(token => token.type === Token.FILTER) ?? [];
  if (filters.length !== 1) {
    return null;
  }

  const filter = filters[0]!;
  let operator = filter.operator;
  if (filter.negated) {
    switch (operator) {
      case TermOperator.DEFAULT:
        operator = TermOperator.NOT_EQUAL;
        break;
      case TermOperator.CONTAINS:
        operator = TermOperator.DOES_NOT_CONTAIN;
        break;
      case TermOperator.STARTS_WITH:
        operator = TermOperator.DOES_NOT_START_WITH;
        break;
      case TermOperator.ENDS_WITH:
        operator = TermOperator.DOES_NOT_END_WITH;
        break;
      default:
        break;
    }
  }

  return {attributeKey: filter.key.text, operator, value: filter.value.text};
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
  actionPanel?: {
    context: string;
    label: string;
    only?: boolean;
    order?: number;
  };
  currentFilter?: SearchFilter;
  displayLabel?: string;
  initialAttributeKey?: string;
  initialOperator?: TermOperator;
}

function TraceItemFilterActionsComponent({
  addSearchFilter,
  actionPanel,
  booleanAttributes,
  currentFilter,
  displayLabel,
  id,
  initialAttributeKey,
  initialOperator,
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
    const isCurrent =
      currentFilter?.key === tag.key &&
      currentFilter.op === operator &&
      String(currentFilter.value) === value;
    return {
      display: {
        label: value,
        labelSuffix: isCurrent ? <Text size="sm">{t('Current')}</Text> : undefined,
      },
      onAction: () => addSearchFilter({key: tag.key, op: operator, value}),
    };
  };

  const valueResource =
    (tag: Tag, operator: TermOperator) =>
    (query: string, context: {state?: 'selected'}) => {
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
            item.value === null ? [] : [makeValueAction(tag, operator, item.value)]
          );
          return actions.length > 0 ? [{display: {label: t('Value')}, actions}] : [];
        },
        enabled: context.state === 'selected',
      });
    };

  const renderOperatorActions = (tag: Tag, type: 'boolean' | 'string') => {
    const operators = FILTER_OPERATORS[type];

    return (
      <CMDKAction display={{label: t('Operator')}}>
        {operators.map(operator => {
          const display = {
            label: OP_LABELS[operator],
            labelSuffix:
              currentFilter?.key === tag.key && currentFilter.op === operator ? (
                <Text size="sm">{t('Current')}</Text>
              ) : undefined,
          };

          if (type === 'boolean') {
            return (
              <CMDKAction
                key={operator || 'is'}
                display={display}
                prompt={t('Search for value')}
              >
                <CMDKAction display={{label: t('Value')}}>
                  {BOOLEAN_FILTER_VALUES.map(value => (
                    <CMDKAction key={value} {...makeValueAction(tag, operator, value)} />
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
              resource={valueResource(tag, operator)}
            />
          );
        })}
        {type === 'string' && (
          <CMDKAction
            display={{label: t('has')}}
            onAction={() =>
              addSearchFilter({
                key: 'has',
                op: TermOperator.DEFAULT,
                value: tag.key,
              })
            }
          />
        )}
      </CMDKAction>
    );
  };

  const renderAttribute = (tag: Tag, type: 'boolean' | 'string') => {
    return (
      <CMDKAction
        key={`${type}-${tag.key}`}
        display={{
          label: tag.name ?? tag.key,
          labelSuffix:
            currentFilter?.key === tag.key ? (
              <Text size="sm">{t('Current')}</Text>
            ) : undefined,
          trailingItem: <TypeBadge kind={tag.kind} />,
        }}
        keywords={[tag.key]}
        prompt={t('Search for operator')}
      >
        {renderOperatorActions(tag, type)}
      </CMDKAction>
    );
  };

  const attributeLessActions = (
    <CMDKAction
      display={{label: t('None')}}
      keywords={['none', 'has']}
      prompt={t('Search for operator')}
    >
      <CMDKAction display={{label: t('Operator')}}>
        <CMDKAction
          display={{label: t('has')}}
          prompt={t('Enter filter value')}
          resource={(query, context) =>
            cmdkQueryOptions({
              queryKey: ['command-palette', 'filter', 'has', query],
              queryFn: () => Promise.resolve(query.trim()),
              select: value =>
                value
                  ? [
                      {
                        display: {label: value},
                        onAction: () =>
                          addSearchFilter({
                            key: 'has',
                            op: TermOperator.DEFAULT,
                            value,
                          }),
                      },
                    ]
                  : [],
              enabled: context.state === 'selected',
            })
          }
        />
      </CMDKAction>
    </CMDKAction>
  );

  const initialStringAttribute = initialAttributeKey
    ? stringAttributes[initialAttributeKey]
    : undefined;
  const initialBooleanAttribute = initialAttributeKey
    ? booleanAttributes[initialAttributeKey]
    : undefined;

  if (initialOperator !== undefined && initialStringAttribute) {
    return (
      <CMDKAction
        id={id}
        actionPanel={actionPanel}
        actionContext="filter"
        display={{label: displayLabel ?? t('Change Filter Value')}}
        keywords={['change', 'filter', 'value']}
        prompt={t('Search for value')}
        resource={valueResource(initialStringAttribute, initialOperator)}
      />
    );
  }

  if (initialOperator !== undefined && initialBooleanAttribute) {
    return (
      <CMDKAction
        id={id}
        actionPanel={actionPanel}
        actionContext="filter"
        display={{label: displayLabel ?? t('Change Filter Value')}}
        keywords={['change', 'filter', 'value']}
      >
        <CMDKAction display={{label: t('Value')}}>
          {BOOLEAN_FILTER_VALUES.map(value => (
            <CMDKAction
              key={value}
              {...makeValueAction(initialBooleanAttribute, initialOperator, value)}
            />
          ))}
        </CMDKAction>
      </CMDKAction>
    );
  }

  return (
    <CMDKAction
      deferChildren
      id={id}
      actionPanel={actionPanel}
      actionContext="filter"
      display={{label: displayLabel ?? t('Add Filter By')}}
      keywords={['add', 'search', 'filter', 'narrow', 'where', 'show']}
      prompt={initialAttributeKey ? t('Search for operator') : t('Search for attribute')}
    >
      {initialStringAttribute ? (
        renderOperatorActions(initialStringAttribute, 'string')
      ) : initialBooleanAttribute ? (
        renderOperatorActions(initialBooleanAttribute, 'boolean')
      ) : (
        <CMDKAction display={{label: t('Attribute')}}>
          {attributeLessActions}
          {sortedStringAttributes.map(tag => renderAttribute(tag, 'string'))}
          {sortedBooleanAttributes.map(tag => renderAttribute(tag, 'boolean'))}
        </CMDKAction>
      )}
    </CMDKAction>
  );
}

export const TraceItemFilterActions = memo(TraceItemFilterActionsComponent);

function TraceItemFilterRowsComponent({
  onClearFilter,
  onDeleteFilter,
  orderStart,
  pendingRows,
  summary,
  targetAction,
}: {
  orderStart: number;
  pendingRows: number;
  summary: string;
  targetAction: string | ((filter: string, index: number) => string);
  onClearFilter?: (index: number) => void;
  onDeleteFilter?: (index: number) => void;
}) {
  const filters = getFilterRows(summary);
  const rows = [...filters, ...Array.from({length: pendingRows}, () => '')];

  return rows.map((filter, index) => {
    const rowId = `trace-item-filter-${index}`;

    return (
      <Fragment key={rowId}>
        <CMDKAction
          id={rowId}
          actionContext={`filter:${index}`}
          display={{
            label: t('Filter By'),
            trailingItem: <QueryValue value={filter} />,
          }}
          keywords={['search', 'filter', 'narrow', 'where', 'show', filter]}
          order={orderStart + index}
          targetAction={
            typeof targetAction === 'function'
              ? targetAction(filter, index)
              : targetAction
          }
        />
        {filter && onClearFilter && (
          <CMDKAction
            actionPanel={{
              context: `filter:${index}`,
              label: t('Clear Filter'),
              only: true,
            }}
            display={{label: t('Clear Filter')}}
            onAction={() => onClearFilter(index)}
          />
        )}
        {rows.length > 1 && onDeleteFilter && (
          <CMDKAction
            actionPanel={{
              context: `filter:${index}`,
              label: t('Delete Filter'),
              only: true,
            }}
            display={{label: t('Delete Filter')}}
            onAction={() => onDeleteFilter(index)}
          />
        )}
      </Fragment>
    );
  });
}

export const TraceItemFilterRows = memo(TraceItemFilterRowsComponent);

function QueryValue({value}: {value: string}) {
  return (
    <Text size="sm" variant={value ? 'accent' : 'muted'} ellipsis>
      {value || t('None')}
    </Text>
  );
}
