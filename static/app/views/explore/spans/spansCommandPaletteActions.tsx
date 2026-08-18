import {Fragment, useEffect, useMemo, useState} from 'react';
import orderBy from 'lodash/orderBy';

import {Text} from '@sentry/scraps/text';

import {
  cmdkQueryOptions,
  type CommandPaletteAction,
} from 'sentry/components/commandPalette/types';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CMDKChainedActionScope} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {IconCheckmark, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import type {Sort} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeFunction,
  MAX_VISUALIZES,
  type Visualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SearchFilter {
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
  const isNegated = [
    TermOperator.NOT_EQUAL,
    TermOperator.DOES_NOT_CONTAIN,
    TermOperator.DOES_NOT_START_WITH,
    TermOperator.DOES_NOT_END_WITH,
  ].includes(filter.op);
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

const STRING_FILTER_OPERATORS = [
  {label: t('is'), op: TermOperator.DEFAULT},
  {label: t('is not'), op: TermOperator.NOT_EQUAL},
  {label: t('contains'), op: TermOperator.CONTAINS},
  {label: t("doesn't contain"), op: TermOperator.DOES_NOT_CONTAIN},
  {label: t('starts with'), op: TermOperator.STARTS_WITH},
  {label: t("doesn't start with"), op: TermOperator.DOES_NOT_START_WITH},
  {label: t('ends with'), op: TermOperator.ENDS_WITH},
  {label: t("doesn't end with"), op: TermOperator.DOES_NOT_END_WITH},
] as const;

const BOOLEAN_FILTER_OPERATORS = STRING_FILTER_OPERATORS.slice(0, 2);

function getFilterValueSelectionKey(tagKey: string, operator: TermOperator) {
  return `${tagKey}:${operator}`;
}

function FilterActions({
  addSearchFilter,
  summary,
}: {
  addSearchFilter: (filter: SearchFilter) => void;
  summary: string;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const commandPaletteState = useCommandPaletteState();
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  const getStringAttributeValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.SPANS,
    type: 'string',
  });

  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');
  const datetimeParams = normalizeDateTimeParams(selection.datetime);

  useEffect(() => {
    if (!commandPaletteState.open) {
      setSelectedValues({});
    }
  }, [commandPaletteState.open]);

  const sortedStringAttributes = useMemo(
    () => orderBy(Object.values(stringAttributes), ['key']),
    [stringAttributes]
  );

  const sortedBooleanAttributes = useMemo(
    () => orderBy(Object.values(booleanAttributes), ['key']),
    [booleanAttributes]
  );

  const renderValueAction = (
    tag: Tag,
    operator: (typeof STRING_FILTER_OPERATORS)[number],
    value: string
  ): CommandPaletteAction => {
    const selectionKey = getFilterValueSelectionKey(tag.key, operator.op);
    const currentSelection = selectedValues[selectionKey] ?? [];
    const isSelected = currentSelection.includes(value);

    return {
      display: {
        label: value,
        icon: isSelected ? <IconCheckmark /> : undefined,
        labelSuffix: (
          <Text size="sm" variant="muted">
            {isSelected ? t('Selected') : t('Not selected')}
          </Text>
        ),
      },
      multiSelect: true,
      onMultiSelect: () => {
        setSelectedValues(current => {
          const values = current[selectionKey] ?? [];
          return {
            ...current,
            [selectionKey]: values.includes(value)
              ? values.filter(selectedValue => selectedValue !== value)
              : [...values, value],
          };
        });
      },
      onAction: () => {
        const valuesToCommit = isSelected
          ? currentSelection
          : [...currentSelection, value];
        for (const selectedValue of valuesToCommit) {
          addSearchFilter({key: tag.key, op: operator.op, value: selectedValue});
        }
        setSelectedValues(current => ({...current, [selectionKey]: []}));
      },
    };
  };

  const renderAttribute = (tag: Tag, type: 'boolean' | 'string') => {
    const operators =
      type === 'boolean' ? BOOLEAN_FILTER_OPERATORS : STRING_FILTER_OPERATORS;

    return (
      <CMDKAction
        key={`${type}-${tag.key}`}
        display={{
          label: tag.name ?? tag.key,
          trailingItem: <TypeBadge kind={tag.kind} />,
        }}
        keywords={[tag.key]}
        prompt={t('Search for operator')}
        resource={(_query, context) =>
          cmdkQueryOptions({
            queryKey: ['cmdk-span-filter-operators', type, tag.key],
            queryFn: () =>
              operators.map(operator => ({
                display: {label: operator.label},
                onAction: () => {},
              })),
            enabled: context.state === 'selected',
            staleTime: Infinity,
          })
        }
      >
        {operatorActions => (
          <CMDKAction display={{label: t('Operator')}}>
            {operatorActions.map((operatorAction, index) => {
              const operator = operators[index];
              if (!operator) {
                return null;
              }

              const renderValues = (values: CommandPaletteAction[]) => (
                <CMDKAction display={{label: t('Value')}}>
                  {values.map((value, valueIndex) =>
                    'onAction' in value ? (
                      <CMDKAction key={valueIndex} {...value} />
                    ) : null
                  )}
                </CMDKAction>
              );

              if (type === 'boolean') {
                return (
                  <CMDKAction
                    key={operator.op || 'is'}
                    display={operatorAction.display}
                    prompt={t('Search for value')}
                    resource={(_query, context) =>
                      cmdkQueryOptions({
                        queryKey: [
                          'cmdk-span-filter-values',
                          organization.slug,
                          selection.projects,
                          datetimeParams,
                          tag.key,
                          operator.op,
                        ],
                        queryFn: () => ['true', 'false'],
                        select: values =>
                          values.map(value => renderValueAction(tag, operator, value)),
                        enabled: context.state === 'selected',
                        staleTime: Infinity,
                      })
                    }
                  >
                    {renderValues}
                  </CMDKAction>
                );
              }

              return (
                <CMDKAction
                  key={operator.op || 'is'}
                  display={operatorAction.display}
                  prompt={t('Search for value')}
                  resource={(query, context) =>
                    cmdkQueryOptions({
                      queryKey: [
                        'cmdk-span-filter-values',
                        organization.slug,
                        selection.projects,
                        datetimeParams,
                        tag.key,
                        operator.op,
                        query,
                      ],
                      queryFn: () =>
                        getStringAttributeValues({
                          tag: {key: tag.key, name: tag.name, kind: tag.kind},
                          searchQuery: query,
                        }),
                      select: values =>
                        values.map(item => renderValueAction(tag, operator, item.value)),
                      enabled: context.state === 'selected',
                      staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
                    })
                  }
                >
                  {renderValues}
                </CMDKAction>
              );
            })}
          </CMDKAction>
        )}
      </CMDKAction>
    );
  };

  return (
    <CMDKAction
      display={{
        label: summary ? t('Edit Filter by') : t('Add Filter by'),
        trailingItem: (
          <Text size="sm" variant={summary ? 'accent' : 'muted'} ellipsis>
            {summary || t('None')}
          </Text>
        ),
      }}
      keywords={['search', 'filter', 'narrow', 'where', 'show', summary]}
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

function SeriesActions({
  onChange,
  seriesId,
  visualize,
}: {
  onChange: (visualize: Visualize) => void;
  seriesId: string;
  visualize: Visualize;
}) {
  const parsedFunction = isVisualizeFunction(visualize) ? visualize.parsedFunction : null;
  const sourceSummary = parsedFunction?.arguments[0] ?? visualize.yAxis;
  const aggregateSummary = parsedFunction?.name ?? t('Equation');

  return (
    <Fragment>
      <CMDKAction
        id={`${seriesId}-source`}
        display={{
          label: t('Edit Source'),
          trailingItem: <QueryValue value={sourceSummary} />,
        }}
        prompt={t('Search for sources')}
      >
        <SourceActions visualize={visualize} onChange={onChange} />
      </CMDKAction>
      <CMDKAction
        id={`${seriesId}-aggregate`}
        display={{
          label: t('Edit Aggregate Function'),
          trailingItem: <QueryValue value={aggregateSummary} />,
        }}
        prompt={t('Search for aggregate functions')}
      >
        {isVisualizeFunction(visualize) &&
          ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => (
            <CMDKAction
              key={aggregate}
              display={{
                label: aggregate,
                trailingItem: getAggregateKind(aggregate),
              }}
              onAction={() => {
                const currentFunction = visualize.parsedFunction;
                if (!currentFunction) {
                  return;
                }
                onChange(
                  visualize.replace({
                    yAxis: updateVisualizeAggregate({
                      newAggregate: aggregate,
                      oldAggregate: currentFunction.name,
                      oldArguments: currentFunction.arguments,
                    }),
                  })
                );
              }}
            />
          ))}
      </CMDKAction>
    </Fragment>
  );
}

function GroupByActions({
  groupBys,
  setGroupBys,
}: {
  groupBys: readonly string[];
  setGroupBys: (groupBys: string[]) => void;
}) {
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');
  const options = useGroupByFields({
    booleanTags,
    groupBys,
    numberTags,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
  }).filter(option => option.value !== UNGROUPED);

  return (
    <CMDKAction display={{label: t('Attribute')}}>
      {options.map(option => {
        const isSelected = groupBys.includes(option.value);

        return (
          <CMDKAction
            key={option.value}
            display={{
              label: option.textValue ?? option.value,
              icon: isSelected ? <IconCheckmark /> : undefined,
              labelSuffix: (
                <Text size="sm" variant="muted">
                  {isSelected ? t('Selected') : t('Not selected')}
                </Text>
              ),
              trailingItem:
                typeof option.trailingItems === 'function'
                  ? option.trailingItems({
                      disabled: false,
                      isFocused: false,
                      isSelected,
                    })
                  : option.trailingItems,
            }}
            keywords={[option.value]}
            multiSelect
            onAction={() => {
              if (!isSelected) {
                setGroupBys([...groupBys.filter(Boolean), option.value]);
              }
            }}
            onMultiSelect={() => {
              setGroupBys(
                isSelected
                  ? groupBys.filter(groupBy => groupBy !== option.value)
                  : [...groupBys.filter(Boolean), option.value]
              );
            }}
          />
        );
      })}
    </CMDKAction>
  );
}

function SortActions({
  groupBys,
  mode,
  setSortBys,
  sortBys,
  visualizes,
}: {
  groupBys: readonly string[];
  mode: Mode;
  setSortBys: (sortBys: Sort[]) => void;
  sortBys: readonly Sort[];
  visualizes: readonly Visualize[];
}) {
  const fields = useQueryParamsFields();
  const currentSort = sortBys[0];
  const fieldOptions = useSortByFields({
    config: {traceItemType: TraceItemDataset.SPANS, enabled: true},
    fields,
    groupBys,
    mode,
    yAxes: visualizes.map(visualize => visualize.yAxis),
  });
  const currentSortKind = currentSort?.kind ?? 'desc';

  return (
    <CMDKAction display={{label: t('Sort by')}}>
      {fieldOptions.map(option => (
        <CMDKAction
          key={option.value}
          display={{
            label: option.textValue ?? option.value,
            labelSuffix:
              option.value === currentSort?.field ? (
                <QueryValue value={t('Current')} />
              ) : undefined,
            trailingItem:
              typeof option.trailingItems === 'function'
                ? option.trailingItems({
                    disabled: false,
                    isFocused: false,
                    isSelected: option.value === currentSort?.field,
                  })
                : option.trailingItems,
          }}
          keywords={[option.value]}
          prompt={t('Select sort order')}
          resource={(_query, context) =>
            cmdkQueryOptions({
              queryKey: [
                'cmdk-spans-sort-order',
                option.value,
                currentSort?.field,
                currentSortKind,
              ],
              queryFn: () => [
                {
                  display: {
                    label: t('Desc'),
                    labelSuffix:
                      currentSortKind === 'desc' ? (
                        <QueryValue value={t('Current')} />
                      ) : undefined,
                  },
                  onAction: () => setSortBys([{field: option.value, kind: 'desc'}]),
                },
                {
                  display: {
                    label: t('Asc'),
                    labelSuffix:
                      currentSortKind === 'asc' ? (
                        <QueryValue value={t('Current')} />
                      ) : undefined,
                  },
                  onAction: () => setSortBys([{field: option.value, kind: 'asc'}]),
                },
              ],
              enabled: context.state === 'selected',
              staleTime: Infinity,
            })
          }
        >
          {orders => (
            <CMDKAction display={{label: t('Order by')}}>
              {orders.map((order, index) =>
                'onAction' in order ? <CMDKAction key={index} {...order} /> : null
              )}
            </CMDKAction>
          )}
        </CMDKAction>
      ))}
    </CMDKAction>
  );
}

function SourceActions({
  onChange,
  visualize,
}: {
  onChange: (visualize: Visualize) => void;
  visualize: Visualize;
}) {
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');
  const parsedFunction = isVisualizeFunction(visualize) ? visualize.parsedFunction : null;
  const options = useVisualizeFields({
    booleanTags,
    numberTags,
    parsedFunction,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
  });

  if (!isVisualizeFunction(visualize) || !parsedFunction) {
    return null;
  }

  return options.map(option => (
    <CMDKAction
      key={option.value}
      display={{
        label: option.textValue ?? option.value,
        trailingItem:
          typeof option.trailingItems === 'function'
            ? option.trailingItems({
                disabled: false,
                isFocused: false,
                isSelected: option.value === parsedFunction.arguments[0],
              })
            : option.trailingItems,
      }}
      keywords={[option.value]}
      onAction={() =>
        onChange(
          visualize.replace({
            yAxis: `${parsedFunction.name}(${option.value})`,
          })
        )
      }
    />
  ));
}

function getAggregateKind(aggregate: string): React.ReactNode {
  if (aggregate.startsWith('p') || aggregate === 'percentile') {
    return (
      <Text size="sm" variant="accent">
        {t('Percentile')}
      </Text>
    );
  }
  if (aggregate === 'avg' || aggregate === 'count_unique') {
    return (
      <Text size="sm" variant="promotion">
        {t('Algebraic')}
      </Text>
    );
  }
  return (
    <Text size="sm" variant="success">
      {t('Distributive')}
    </Text>
  );
}

function QueryValue({value}: {value: string}) {
  return (
    <Text size="sm" variant={value ? 'accent' : 'muted'} ellipsis>
      {value || t('None')}
    </Text>
  );
}

function QueryClauseActions() {
  const commandPaletteState = useCommandPaletteState();
  const setQueryParams = useSetQueryParams();
  const visualizes = useQueryParamsVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const sampleSortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftVisualizes, setDraftVisualizes] = useState<Visualize[]>([...visualizes]);
  const [draftGroupBys, setDraftGroupBys] = useState<string[]>([...groupBys]);
  const [draftSampleSortBys, setDraftSampleSortBys] = useState<Sort[]>([
    ...sampleSortBys,
  ]);
  const [draftAggregateSortBys, setDraftAggregateSortBys] = useState<Sort[]>([
    ...aggregateSortBys,
  ]);

  useEffect(() => {
    if (!commandPaletteState.open) {
      setDraftQuery(query);
      setDraftVisualizes([...visualizes]);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDraftGroupBys([...groupBys]);
      // The palette intentionally snapshots URL state when it closes so a new
      // editing session starts from the latest applied values.
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDraftSampleSortBys([...sampleSortBys]);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDraftAggregateSortBys([...aggregateSortBys]);
    }
  }, [
    aggregateSortBys,
    commandPaletteState.open,
    groupBys,
    query,
    sampleSortBys,
    visualizes,
  ]);

  const addSearchFilter = (filter: SearchFilter) => {
    setDraftQuery(currentQuery => addSearchFilterToQuery(currentQuery, filter));
  };

  const groupBySummary = draftGroupBys.filter(Boolean).join(', ');
  const draftMode = draftGroupBys.some(Boolean) ? Mode.AGGREGATE : Mode.SAMPLES;
  const draftSortBys =
    draftMode === Mode.SAMPLES ? draftSampleSortBys : draftAggregateSortBys;
  const setDraftSortBys =
    draftMode === Mode.SAMPLES ? setDraftSampleSortBys : setDraftAggregateSortBys;
  const sortBySummary = draftSortBys
    .map(sort => `${sort.field}, ${sort.kind}`)
    .join(', ');
  const updateVisualize = (index: number, nextVisualize: Visualize) => {
    setDraftVisualizes(currentVisualizes =>
      currentVisualizes.map((visualize, visualizeIndex) =>
        visualizeIndex === index ? nextVisualize : visualize
      )
    );
  };

  return (
    <Fragment>
      <CMDKChainedActionScope>
        <CMDKAction display={{label: t('Commands')}}>
          <CMDKAction
            closeOnAction
            display={{label: t('Apply Changes')}}
            keywords={['apply', 'save', 'changes']}
            onAction={() => {
              setQueryParams({
                aggregateFields: [
                  ...draftGroupBys.map(groupBy => ({groupBy})),
                  ...draftVisualizes.map(visualize => visualize.serialize()),
                ],
                aggregateSortBys: draftAggregateSortBys,
                mode: draftMode,
                query: draftQuery,
                sortBys: draftSampleSortBys,
              });
            }}
          />
          <CMDKAction
            display={{
              label: groupBySummary ? t('Edit Group by') : t('Add Group by'),
              trailingItem: <QueryValue value={groupBySummary} />,
            }}
            prompt={t('Search for attribute')}
          >
            <GroupByActions groupBys={draftGroupBys} setGroupBys={setDraftGroupBys} />
          </CMDKAction>
          <FilterActions addSearchFilter={addSearchFilter} summary={draftQuery} />
          <CMDKAction
            id="spans-sort"
            display={{
              label: t('Edit Sort By'),
              trailingItem: <QueryValue value={sortBySummary} />,
            }}
            prompt={t('Search for an attribute')}
          >
            <SortActions
              groupBys={draftGroupBys}
              mode={draftMode}
              setSortBys={setDraftSortBys}
              sortBys={draftSortBys}
              visualizes={draftVisualizes}
            />
          </CMDKAction>
        </CMDKAction>
      </CMDKChainedActionScope>
      <CMDKChainedActionScope>
        {draftVisualizes.length < MAX_VISUALIZES && (
          <CMDKAction
            display={{label: t('Add Series')}}
            keywords={['add', 'chart', 'series', 'source', 'visualization']}
            onAction={() =>
              setDraftVisualizes(currentVisualizes => [
                ...currentVisualizes,
                new VisualizeFunction(DEFAULT_VISUALIZATION),
              ])
            }
          />
        )}
        {draftVisualizes.map((visualize, index) => (
          <CMDKAction
            key={`series-details-${index}`}
            id={`spans-series-details-${index}`}
            display={{label: t('Series %s', String.fromCharCode(65 + index))}}
          >
            <SeriesActions
              visualize={visualize}
              onChange={nextVisualize => updateVisualize(index, nextVisualize)}
              seriesId={`spans-series-${index}`}
            />
            {draftVisualizes.length > 1 && (
              <CMDKAction
                display={{label: t('Delete Series')}}
                keywords={['delete', 'remove', 'series']}
                onAction={() =>
                  setDraftVisualizes(currentVisualizes =>
                    currentVisualizes.filter(
                      (_, visualizeIndex) => visualizeIndex !== index
                    )
                  )
                }
              />
            )}
          </CMDKAction>
        ))}
      </CMDKChainedActionScope>
    </Fragment>
  );
}

export function SpansCommandPaletteActions() {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: t('Traces'), icon: <IconSpan />}}>
        <QueryClauseActions />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
