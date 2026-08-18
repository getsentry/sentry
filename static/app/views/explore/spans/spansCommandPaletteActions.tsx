import {Fragment, useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  CMDKChainedActionScope,
  CMDKTerminalActionScope,
} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {IconCheckmark, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {
  addSearchFilterToQuery,
  type SearchFilter,
  TraceItemFilterActions,
} from 'sentry/views/explore/components/traceItemFilterActions';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
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

function SpansFilterActions({
  addSearchFilter,
  summary,
}: {
  addSearchFilter: (filter: SearchFilter) => void;
  summary: string;
}) {
  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');

  return (
    <TraceItemFilterActions
      addSearchFilter={addSearchFilter}
      booleanAttributes={booleanAttributes}
      stringAttributes={stringAttributes}
      summary={summary}
      traceItemType={TraceItemDataset.SPANS}
    />
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
          label: t('Source'),
          trailingItem: <QueryValue value={sourceSummary} />,
        }}
        prompt={t('Search for sources')}
      >
        <SourceActions visualize={visualize} onChange={onChange} />
      </CMDKAction>
      <CMDKAction
        id={`${seriesId}-aggregate`}
        display={{
          label: t('Aggregate function'),
          trailingItem: <QueryValue value={aggregateSummary} />,
        }}
        prompt={t('Search for aggregate functions')}
      >
        {isVisualizeFunction(visualize) &&
          ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => (
            <CMDKAction
              key={aggregate}
              display={{label: aggregate}}
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
              labelSuffix: isSelected ? <QueryValue value={t('Current')} /> : undefined,
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
        >
          <CMDKAction display={{label: t('Order by')}}>
            {(['desc', 'asc'] as const).map(kind => (
              <CMDKAction
                key={kind}
                display={{
                  label: kind === 'desc' ? t('Desc') : t('Asc'),
                  labelSuffix:
                    currentSortKind === kind ? (
                      <QueryValue value={t('Current')} />
                    ) : undefined,
                }}
                onAction={() => setSortBys([{field: option.value, kind}])}
              />
            ))}
          </CMDKAction>
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
    <CMDKChainedActionScope>
      <CMDKTerminalActionScope>
        <CMDKAction
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
      </CMDKTerminalActionScope>
      <CMDKAction display={{label: t('Query')}}>
        <CMDKAction
          display={{
            label: groupBySummary ? t('Group by') : t('Add Group by'),
            trailingItem: <QueryValue value={groupBySummary} />,
          }}
          prompt={t('Search for attribute')}
        >
          <GroupByActions groupBys={draftGroupBys} setGroupBys={setDraftGroupBys} />
        </CMDKAction>
        <SpansFilterActions addSearchFilter={addSearchFilter} summary={draftQuery} />
        <CMDKAction
          id="spans-sort"
          display={{
            label: t('Sort by'),
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
      <CMDKAction display={{label: t('Series')}}>
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
      </CMDKAction>
    </CMDKChainedActionScope>
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
