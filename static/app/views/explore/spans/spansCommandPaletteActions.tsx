import {Fragment, useEffect, useMemo, useState} from 'react';
import orderBy from 'lodash/orderBy';

import {Text} from '@sentry/scraps/text';

import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import {
  CMDKAction,
  type CMDKResourceContext,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CMDKChainedActionScope} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {Sort} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeFunction,
  MAX_VISUALIZES,
  type Visualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SpanAttributeValue {
  value: string;
}

interface SearchFilter {
  key: string;
  value: string | number | boolean;
  negated?: boolean;
  op?: '>' | '<';
}

function capitalizeLabel(label: string): string {
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function FilterActions({
  addSearchFilter,
  summary,
}: {
  addSearchFilter: (filter: SearchFilter) => void;
  summary: string;
}) {
  const organization = useOrganization();
  const {selection: pageFilters} = usePageFilters();

  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');

  const pageFilterCacheKey = useMemo(
    () =>
      [
        pageFilters.projects.join(','),
        pageFilters.datetime.period ?? '',
        pageFilters.datetime.start?.toString() ?? '',
        pageFilters.datetime.end?.toString() ?? '',
      ].join('|'),
    [pageFilters]
  );

  const sortedStringAttributes = useMemo(
    () => orderBy(Object.values(stringAttributes), ['key']),
    [stringAttributes]
  );

  const sortedBooleanAttributes = useMemo(
    () => orderBy(Object.values(booleanAttributes), ['key']),
    [booleanAttributes]
  );

  const makeStringFilterItem = (tag: Tag) => ({
    display: {label: capitalizeLabel(tag.name ?? tag.key)},
    keywords: [tag.key],
    prompt: t('Select a value...'),
    resource: (_q: string, ctx: CMDKResourceContext) =>
      // Include the draft summary in the key so action closures never overwrite
      // filters selected earlier in the same command-palette session.
      cmdkQueryOptions({
        ...apiOptions.as<SpanAttributeValue[]>()(
          '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/values/',
          {
            path: {organizationIdOrSlug: organization.slug, key: tag.key},
            query: {
              itemType: TraceItemDataset.SPANS,
              attributeType: 'string',
              ...(pageFilters.projects.length
                ? {project: pageFilters.projects.map(String)}
                : {}),
              ...normalizeDateTimeParams(pageFilters.datetime),
            },
            staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
          }
        ),
        select: result => {
          return result.json
            .filter(item => item.value)
            .map(item => ({
              display: {label: item.value},
              onAction: () => addSearchFilter({key: tag.key, value: item.value}),
            }));
        },
        enabled: ctx.state === 'selected',
      }),
  });

  const makeStringSectionResource = (tags: Tag[], cacheKey: string) => () =>
    // Include tags.length so the section updates when attributes finish loading.
    // Include summary so the item closures capture fresh draft filter state.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    cmdkQueryOptions({
      queryKey: [cacheKey, organization.slug, pageFilterCacheKey, summary, tags.length],
      queryFn: () => tags.map(makeStringFilterItem),
      staleTime: Infinity,
    });

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
    >
      {sortedStringAttributes.length > 0 && (
        <CMDKAction
          display={{label: t('Span Attributes')}}
          prompt={t('Select a filter...')}
          limit={4}
          resource={makeStringSectionResource(
            sortedStringAttributes,
            'cmdk-span-filter-keys-string'
          )}
        />
      )}
      {sortedBooleanAttributes.length > 0 && (
        <CMDKAction
          display={{label: t('Boolean Attributes')}}
          prompt={t('Select a filter...')}
          limit={4}
        >
          {sortedBooleanAttributes.map(tag => (
            <CMDKAction
              key={tag.key}
              display={{label: capitalizeLabel(tag.name ?? tag.key)}}
              keywords={[tag.key]}
            >
              <CMDKAction
                display={{label: t('true')}}
                onAction={() => addSearchFilter({key: tag.key, value: 'true'})}
              />
              <CMDKAction
                display={{label: t('false')}}
                onAction={() => addSearchFilter({key: tag.key, value: 'false'})}
              />
            </CMDKAction>
          ))}
        </CMDKAction>
      )}
    </CMDKAction>
  );
}

function SeriesActions({
  addSearchFilter,
  groupBys,
  groupBySummary,
  mode,
  onChange,
  query,
  seriesId,
  setSortBys,
  sortBys,
  sortBySummary,
  visualize,
  visualizes,
}: {
  addSearchFilter: (filter: SearchFilter) => void;
  groupBySummary: string;
  groupBys: readonly string[];
  mode: Mode;
  onChange: (visualize: Visualize) => void;
  query: string;
  seriesId: string;
  setSortBys: (sortBys: Sort[]) => void;
  sortBySummary: string;
  sortBys: readonly Sort[];
  visualize: Visualize;
  visualizes: readonly Visualize[];
}) {
  const parsedFunction = isVisualizeFunction(visualize) ? visualize.parsedFunction : null;
  const sourceSummary = parsedFunction?.arguments[0] ?? visualize.yAxis;
  const aggregateSummary = parsedFunction?.name ?? t('Equation');

  return (
    <Fragment>
      <CMDKAction
        id={`${seriesId}-source-${sourceSummary}`}
        display={{
          label: t('Edit Source'),
          trailingItem: <QueryValue value={sourceSummary} />,
        }}
        prompt={t('Search for sources...')}
      >
        <SourceActions visualize={visualize} onChange={onChange} />
      </CMDKAction>
      <CMDKAction
        id={`${seriesId}-aggregate-${aggregateSummary}`}
        display={{
          label: t('Edit Aggregate Function'),
          trailingItem: <QueryValue value={aggregateSummary} />,
        }}
        prompt={t('Search for aggregate functions...')}
      >
        {isVisualizeFunction(visualize) &&
          ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => (
            <CMDKAction
              key={aggregate}
              display={{
                label: aggregate,
                trailingItem: <QueryValue value={getAggregateKind(aggregate)} />,
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
      <CMDKAction
        display={{
          label: groupBySummary ? t('Edit Group by') : t('Add Group by'),
          trailingItem: <QueryValue value={groupBySummary} />,
        }}
      >
        <CMDKAction display={{label: t('Configure grouping')}} onAction={() => {}} />
      </CMDKAction>
      <FilterActions
        key={`${seriesId}-filter-${query}`}
        addSearchFilter={addSearchFilter}
        summary={query}
      />
      <CMDKAction
        id={`${seriesId}-sort-${sortBySummary}`}
        display={{
          label: t('Edit Sort By'),
          trailingItem: <QueryValue value={sortBySummary} />,
        }}
      >
        <SortActions
          groupBys={groupBys}
          mode={mode}
          setSortBys={setSortBys}
          sortBys={sortBys}
          visualizes={visualizes}
        />
      </CMDKAction>
    </Fragment>
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
  const currentField = currentSort?.field ?? fieldOptions[0]?.value ?? 'timestamp';
  const currentKind = currentSort?.kind ?? 'desc';
  const currentFieldOption = fieldOptions.find(option => option.value === currentField);

  return (
    <Fragment>
      <CMDKAction
        display={{
          label: t('Edit Field'),
          trailingItem: (
            <QueryValue value={currentFieldOption?.textValue ?? currentField} />
          ),
        }}
        keywords={['field', 'sort', ...fieldOptions.map(option => option.value)]}
        prompt={t('Select sort field')}
      >
        {fieldOptions.map(option => (
          <CMDKAction
            key={option.value}
            display={{label: option.textValue ?? option.value}}
            keywords={[option.value]}
            onAction={() => setSortBys([{field: option.value, kind: currentKind}])}
          />
        ))}
      </CMDKAction>
      <CMDKAction
        display={{
          label: t('Edit Order'),
          trailingItem: (
            <QueryValue
              value={currentKind === 'asc' ? t('Ascending') : t('Descending')}
            />
          ),
        }}
        prompt={t('Select sort order')}
      >
        <CMDKAction
          display={{label: t('Ascending')}}
          onAction={() => setSortBys([{field: currentField, kind: 'asc'}])}
        />
        <CMDKAction
          display={{label: t('Descending')}}
          onAction={() => setSortBys([{field: currentField, kind: 'desc'}])}
        />
      </CMDKAction>
    </Fragment>
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

function getAggregateKind(aggregate: string): string {
  if (aggregate.startsWith('p') || aggregate === 'percentile') {
    return t('Percentile');
  }
  if (aggregate === 'avg' || aggregate === 'count_unique') {
    return t('Algebraic');
  }
  return t('Distributive');
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
  const setVisualizes = useSetQueryParamsVisualizes();
  const visualizes = useQueryParamsVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const sampleSortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftVisualizes, setDraftVisualizes] = useState<Visualize[]>([...visualizes]);
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
      // The palette intentionally snapshots URL state when it closes so a new
      // editing session starts from the latest applied values.
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDraftSampleSortBys([...sampleSortBys]);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDraftAggregateSortBys([...aggregateSortBys]);
    }
  }, [aggregateSortBys, commandPaletteState.open, query, sampleSortBys, visualizes]);

  const addSearchFilter = (filter: SearchFilter) => {
    setDraftQuery(currentQuery => {
      const search = new MutableSearch(currentQuery);
      if (filter.op) {
        search.setFilterValues(filter.key, [`${filter.op}${filter.value}`]);
      } else {
        search.addFilterValue(
          `${filter.negated ? '!' : ''}${filter.key}`,
          String(filter.value)
        );
      }
      return search.formatString();
    });
  };

  const groupBySummary = groupBys.filter(Boolean).join(', ');
  const draftSortBys = mode === Mode.SAMPLES ? draftSampleSortBys : draftAggregateSortBys;
  const setDraftSortBys =
    mode === Mode.SAMPLES ? setDraftSampleSortBys : setDraftAggregateSortBys;
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
      <CMDKAction display={{label: t('Commands')}}>
        <CMDKAction
          display={{label: t('Apply Changes')}}
          keywords={['apply', 'save', 'changes']}
          onAction={() => {
            setVisualizes(draftVisualizes.map(visualize => visualize.serialize()));
            setQueryParams({
              aggregateSortBys: draftAggregateSortBys,
              query: draftQuery,
              sortBys: draftSampleSortBys,
            });
          }}
        />
      </CMDKAction>
      <CMDKChainedActionScope>
        {draftVisualizes.length < MAX_VISUALIZES && (
          <CMDKAction
            display={{label: t('Add Series')}}
            keywords={['add', 'series', 'source', 'visualization']}
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
              addSearchFilter={addSearchFilter}
              groupBys={groupBys}
              groupBySummary={groupBySummary}
              mode={mode}
              onChange={nextVisualize => updateVisualize(index, nextVisualize)}
              query={draftQuery}
              seriesId={`spans-series-${index}`}
              setSortBys={setDraftSortBys}
              sortBys={draftSortBys}
              sortBySummary={sortBySummary}
              visualizes={draftVisualizes}
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
