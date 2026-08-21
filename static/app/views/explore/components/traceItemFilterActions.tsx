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
  TermOperator,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SearchFilter} from 'sentry/views/explore/components/traceItemFilterQuery';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {traceItemAttributeValuesQueryOptions} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import type {TraceItemDataset} from 'sentry/views/explore/types';

const BOOLEAN_FILTER_VALUES = ['true', 'false'] as const;

const FILTER_OPERATORS = {
  boolean: filterTypeConfig[FilterType.BOOLEAN].validOps,
  number: filterTypeConfig[FilterType.NUMERIC].validOps,
  string: filterTypeConfig[FilterType.TEXT].validOps,
} as const;

interface TraceItemFilterActionsProps {
  addSearchFilter: (filter: SearchFilter) => void;
  booleanAttributes: TagCollection;
  id: string;
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
  traceItemType: TraceItemDataset;
  actionPanel?: {
    context: string;
    label: string;
    order?: number;
    placement?: 'palette-and-panel' | 'panel-only';
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
  numberAttributes,
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
  const sortedNumberAttributes = useMemo(
    () => orderBy(Object.values(numberAttributes), ['key']),
    [numberAttributes]
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

  const numberValueResource =
    (tag: Tag, operator: TermOperator) =>
    (query: string, context: {state?: 'selected'}) => {
      const value = query.trim();
      return cmdkQueryOptions({
        queryKey: ['command-palette', 'filter', tag.key, operator, value],
        queryFn: () => Promise.resolve(value),
        select: selectedValue =>
          selectedValue ? [makeValueAction(tag, operator, selectedValue)] : [],
        enabled: context.state === 'selected',
      });
    };

  const stringValueResource =
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

  const renderOperatorActions = (tag: Tag, type: 'boolean' | 'number' | 'string') => {
    const operators = FILTER_OPERATORS[type];

    return (
      <CMDKAction.Group display={{label: t('Operator')}}>
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
              <CMDKAction.Group
                key={operator || 'is'}
                display={display}
                prompt={t('Search for value')}
              >
                <CMDKAction.Group display={{label: t('Value')}}>
                  {BOOLEAN_FILTER_VALUES.map(value => (
                    <CMDKAction.Callback
                      key={value}
                      {...makeValueAction(tag, operator, value)}
                    />
                  ))}
                </CMDKAction.Group>
              </CMDKAction.Group>
            );
          }

          if (type === 'number') {
            return (
              <CMDKAction.Resource
                key={operator || 'is'}
                display={display}
                prompt={t('Search for value')}
                resource={numberValueResource(tag, operator)}
              />
            );
          }

          return (
            <CMDKAction.Resource
              key={operator || 'is'}
              display={display}
              prompt={t('Search for value')}
              resource={stringValueResource(tag, operator)}
            />
          );
        })}
        {type !== 'boolean' && (
          <CMDKAction.Callback
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
      </CMDKAction.Group>
    );
  };

  const renderAttribute = (tag: Tag, type: 'boolean' | 'number' | 'string') => {
    return (
      <CMDKAction.Group
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
      </CMDKAction.Group>
    );
  };

  const attributeLessActions = (
    <CMDKAction.Group
      initialFocus="first-action"
      display={{label: t('None')}}
      keywords={['none', 'has']}
      prompt={t('Search for operator')}
    >
      <CMDKAction.Group display={{label: t('Operator')}}>
        <CMDKAction.Resource
          display={{label: t('has')}}
          prompt={t('Enter filter value')}
          resource={(query, context) =>
            cmdkQueryOptions({
              queryKey: [
                'command-palette',
                'filter',
                'has',
                query,
                sortedStringAttributes,
                sortedNumberAttributes,
                sortedBooleanAttributes,
              ],
              queryFn: () => {
                const typedValue = query.trim();
                const knownValues = [
                  ...sortedStringAttributes,
                  ...sortedNumberAttributes,
                  ...sortedBooleanAttributes,
                ]
                  .map(tag => tag.key)
                  .filter(value =>
                    typedValue
                      ? value.toLocaleLowerCase().includes(typedValue.toLocaleLowerCase())
                      : true
                  );
                return Promise.resolve(
                  typedValue && !knownValues.includes(typedValue)
                    ? [typedValue, ...knownValues]
                    : knownValues
                );
              },
              select: values =>
                values.map(value => ({
                  display: {label: value},
                  onAction: () =>
                    addSearchFilter({
                      key: 'has',
                      op: TermOperator.DEFAULT,
                      value,
                    }),
                })),
              enabled: context.state === 'selected',
            })
          }
        />
      </CMDKAction.Group>
    </CMDKAction.Group>
  );

  const initialStringAttribute = initialAttributeKey
    ? stringAttributes[initialAttributeKey]
    : undefined;
  const initialBooleanAttribute = initialAttributeKey
    ? booleanAttributes[initialAttributeKey]
    : undefined;
  const initialNumberAttribute = initialAttributeKey
    ? numberAttributes[initialAttributeKey]
    : undefined;

  if (initialOperator !== undefined && initialStringAttribute) {
    return (
      <CMDKAction.Resource
        id={id}
        actionPanel={actionPanel}
        actionContext="filter"
        display={{label: displayLabel ?? t('Change Filter Value')}}
        keywords={['change', 'filter', 'value']}
        prompt={t('Search for value')}
        resource={stringValueResource(initialStringAttribute, initialOperator)}
      />
    );
  }

  if (initialOperator !== undefined && initialNumberAttribute) {
    return (
      <CMDKAction.Resource
        id={id}
        actionPanel={actionPanel}
        actionContext="filter"
        display={{label: displayLabel ?? t('Change Filter Value')}}
        keywords={['change', 'filter', 'value']}
        prompt={t('Enter value')}
        resource={numberValueResource(initialNumberAttribute, initialOperator)}
      />
    );
  }

  if (initialOperator !== undefined && initialBooleanAttribute) {
    return (
      <CMDKAction.Group
        id={id}
        actionPanel={actionPanel}
        actionContext="filter"
        display={{label: displayLabel ?? t('Change Filter Value')}}
        keywords={['change', 'filter', 'value']}
      >
        <CMDKAction.Group display={{label: t('Value')}}>
          {BOOLEAN_FILTER_VALUES.map(value => (
            <CMDKAction.Group
              key={value}
              {...makeValueAction(initialBooleanAttribute, initialOperator, value)}
            />
          ))}
        </CMDKAction.Group>
      </CMDKAction.Group>
    );
  }

  return (
    <CMDKAction.Group
      initialFocus={initialAttributeKey ? 'search' : 'first-action'}
      mount="on-open"
      id={id}
      actionPanel={actionPanel}
      actionContext="filter"
      display={{label: displayLabel ?? t('Add Filter By')}}
      keywords={['add', 'search', 'filter', 'narrow', 'where', 'show']}
      prompt={initialAttributeKey ? t('Search for operator') : t('Search for attribute')}
    >
      {initialStringAttribute ? (
        renderOperatorActions(initialStringAttribute, 'string')
      ) : initialNumberAttribute ? (
        renderOperatorActions(initialNumberAttribute, 'number')
      ) : initialBooleanAttribute ? (
        renderOperatorActions(initialBooleanAttribute, 'boolean')
      ) : (
        <CMDKAction.Group display={{label: t('Attribute')}}>
          {attributeLessActions}
          {sortedStringAttributes.map(tag => renderAttribute(tag, 'string'))}
          {sortedNumberAttributes.map(tag => renderAttribute(tag, 'number'))}
          {sortedBooleanAttributes.map(tag => renderAttribute(tag, 'boolean'))}
        </CMDKAction.Group>
      )}
    </CMDKAction.Group>
  );
}

export const TraceItemFilterActions = memo(TraceItemFilterActionsComponent);
