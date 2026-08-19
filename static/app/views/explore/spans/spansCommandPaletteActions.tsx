import {Fragment, memo, useCallback, useEffect, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  CMDKChainedActionScope,
  CMDKTerminalActionScope,
} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  EQUATION_PREFIX,
  parseFunction,
  prettifyParsedFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  addSearchFilterToQuery,
  getFilterRows,
  type SearchFilter,
  TraceItemFilterActions,
  TraceItemFilterRows,
} from 'sentry/views/explore/components/traceItemFilterActions';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSpansSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {generateExploreCompareRoute} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeFunction,
  isVisualizeEquation,
  MAX_VISUALIZES,
  type Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getMetricAlertsUpsellTooltip} from 'sentry/views/explore/utils/saveAsAlertMenuItem';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

const MORE_ACTIONS_ORDER = {
  addChart: 10,
  addEquation: 20,
  addGroupBy: 30,
  addFilter: 40,
  reorderCharts: 50,
  deleteChart: 60,
} as const;

const QUERY_ACTION_ORDER = {
  sort: 0,
  groupBy: 100,
  filter: 200,
} as const;

const ADD_FILTER_ACTION_ID = 'spans-add-filter';
const ADD_GROUP_BY_ACTION_ID = 'spans-add-group-by';

export function canCompareQueries(visualizes: Visualize[]): boolean {
  return visualizes.filter(isVisualizeFunction).length >= 2;
}

export function canReorderCharts(visualizes: readonly Visualize[]): boolean {
  if (visualizes.length <= 1) {
    return false;
  }
  return (
    new Set(visualizes.map(visualize => JSON.stringify(visualize.serialize()))).size > 1
  );
}

export function canDeleteChart(charts: readonly unknown[]): boolean {
  return charts.length >= 2;
}

export function deleteChart<T extends {id: number}>(
  charts: readonly T[],
  chartId: number
): T[] {
  return charts.filter(chart => chart.id !== chartId);
}

export function reorderCharts<T>(
  charts: readonly T[],
  index: number,
  direction: 'up' | 'down'
): T[] {
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (
    index < 0 ||
    index >= charts.length ||
    nextIndex < 0 ||
    nextIndex >= charts.length
  ) {
    return [...charts];
  }

  const reorderedCharts = [...charts];
  const chart = reorderedCharts[index];
  const nextChart = reorderedCharts[nextIndex];
  if (chart === undefined || nextChart === undefined) {
    return reorderedCharts;
  }
  [reorderedCharts[index], reorderedCharts[nextIndex]] = [nextChart, chart];
  return reorderedCharts;
}

function SaveAsActionsComponent() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {projects} = useProjects();
  const [interval] = useChartInterval();
  const {addToDashboard} = useAddToDashboard();
  const {saveQuery} = useSpansSaveQuery();
  const query = useQueryParamsQuery();
  const visualizes = useQueryParamsVisualizes().filter(isVisualizeFunction);
  const visualizeYAxes = dedupeArray(visualizes.map(visualize => visualize.yAxis));
  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(
          candidate => candidate.id === `${pageFilters.selection.projects[0]}`
        );
  const canCreateMonitors = !getMetricAlertsUpsellTooltip(organization);
  const canAddToDashboard = organization.features.includes('dashboards-edit');

  return (
    <CMDKAction display={{label: t('Save as')}}>
      <CMDKTerminalActionScope>
        <CMDKAction
          display={{label: t('New Query')}}
          onAction={() => {
            trackAnalytics('trace_explorer.save_query_modal', {
              action: 'open',
              save_type: 'save_new_query',
              ui_source: 'toolbar',
              organization,
            });
            openSaveQueryModal({
              organization,
              saveQuery,
              source: 'toolbar',
              traceItemDataset: TraceItemDataset.SPANS,
            });
          }}
        />
      </CMDKTerminalActionScope>
      {canCreateMonitors && visualizeYAxes.length > 0 && (
        <CMDKAction
          display={{label: t('Monitor for')}}
          prompt={t('Select a series to monitor')}
        >
          {visualizeYAxes.map((yAxis, index) => {
            const parsedFunction = parseFunction(yAxis);
            const label = parsedFunction ? prettifyParsedFunction(parsedFunction) : yAxis;

            return (
              <CMDKAction
                key={`${yAxis}-${index}`}
                display={{label}}
                to={getAlertsUrl({
                  project,
                  query,
                  pageFilters: pageFilters.selection,
                  aggregate: yAxis,
                  organization,
                  dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                  interval,
                })}
                onAction={() => {
                  trackAnalytics('trace_explorer.save_as', {
                    save_type: 'alert',
                    ui_source: 'toolbar',
                    organization,
                  });
                }}
              />
            );
          })}
        </CMDKAction>
      )}
      {canAddToDashboard && visualizeYAxes.length > 0 && (
        <CMDKTerminalActionScope>
          {visualizeYAxes.length === 1 ? (
            <CMDKAction
              display={{label: t('Dashboard widget')}}
              onAction={() => {
                trackAnalytics('trace_explorer.save_as', {
                  save_type: 'dashboard',
                  ui_source: 'toolbar',
                  organization,
                });
                addToDashboard(0);
              }}
            />
          ) : (
            <CMDKAction
              display={{label: t('Dashboard widget')}}
              prompt={t('Select a series for the dashboard widget')}
            >
              {visualizeYAxes.map((yAxis, index) => {
                const parsedFunction = parseFunction(yAxis);
                return (
                  <CMDKAction
                    key={`${yAxis}-${index}`}
                    display={{
                      label: parsedFunction
                        ? prettifyParsedFunction(parsedFunction)
                        : yAxis,
                    }}
                    onAction={() => {
                      trackAnalytics('trace_explorer.save_as', {
                        save_type: 'dashboard',
                        ui_source: 'toolbar',
                        organization,
                      });
                      addToDashboard(index);
                    }}
                  />
                );
              })}
            </CMDKAction>
          )}
        </CMDKTerminalActionScope>
      )}
    </CMDKAction>
  );
}

const SaveAsActions = memo(SaveAsActionsComponent);

function SpansFilterActionsComponent({
  addSearchFilter,
}: {
  addSearchFilter: (filter: SearchFilter) => void;
}) {
  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');

  return (
    <TraceItemFilterActions
      addSearchFilter={addSearchFilter}
      booleanAttributes={booleanAttributes}
      id={ADD_FILTER_ACTION_ID}
      stringAttributes={stringAttributes}
      traceItemType={TraceItemDataset.SPANS}
    />
  );
}

const SpansFilterActions = memo(SpansFilterActionsComponent);

interface SeriesActionsProps {
  chartId: number;
  index: number;
  seriesId: string;
  updateVisualize: (chartId: number, visualize: Visualize) => void;
  visualize: Visualize;
  visualizes: readonly Visualize[];
}

function SeriesActionsComponent({
  chartId,
  index,
  seriesId,
  updateVisualize,
  visualize,
  visualizes,
}: SeriesActionsProps) {
  if (isVisualizeEquation(visualize)) {
    const expression = stripEquationPrefix(visualize.yAxis);

    return (
      <CMDKAction
        id={`${seriesId}-equation`}
        display={{
          label: t('Edit Equation'),
          trailingItem: <QueryValue value={expression} />,
        }}
        textInput={{
          ariaLabel: t('Edit Equation'),
          initialValue: expression,
          onSubmit: value =>
            updateVisualize(
              chartId,
              visualize.replace({yAxis: `${EQUATION_PREFIX}${value}`})
            ),
          footer: <EquationFooter index={index} visualizes={visualizes} />,
        }}
      />
    );
  }

  const parsedFunction = isVisualizeFunction(visualize) ? visualize.parsedFunction : null;
  const sourceSummary = parsedFunction?.arguments[0] ?? visualize.yAxis;
  const aggregateSummary = parsedFunction?.name ?? t('Equation');

  return (
    <Fragment>
      <CMDKAction
        id={`${seriesId}-source`}
        deferChildren
        display={{
          label: t('Source'),
          trailingItem: <QueryValue value={sourceSummary} />,
        }}
        prompt={t('Search for sources')}
      >
        <SourceActions
          visualize={visualize}
          onChange={nextVisualize => updateVisualize(chartId, nextVisualize)}
        />
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
              display={{
                label: aggregate,
                labelSuffix:
                  aggregate === aggregateSummary ? (
                    <QueryValue value={t('Current')} />
                  ) : undefined,
                trailingItem: getAggregateKind(aggregate),
              }}
              onAction={() => {
                const currentFunction = visualize.parsedFunction;
                if (!currentFunction) {
                  return;
                }
                updateVisualize(
                  chartId,
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

function areSeriesActionsPropsEqual(
  previous: SeriesActionsProps,
  next: SeriesActionsProps
): boolean {
  if (
    previous.chartId !== next.chartId ||
    previous.index !== next.index ||
    previous.seriesId !== next.seriesId ||
    previous.updateVisualize !== next.updateVisualize ||
    previous.visualize !== next.visualize
  ) {
    return false;
  }

  if (!isVisualizeEquation(next.visualize)) {
    return true;
  }

  // Equations only render references to preceding series. Appending a chart does
  // not change that prefix, so existing equation action trees can remain mounted.
  return Array.from({length: next.index}).every(
    (_, index) => previous.visualizes[index] === next.visualizes[index]
  );
}

const SeriesActions = memo(SeriesActionsComponent, areSeriesActionsPropsEqual);

function EquationFooter({
  index,
  visualizes,
}: {
  index: number;
  visualizes: readonly Visualize[];
}) {
  const referencedSeries = visualizes.slice(0, index);

  return (
    <Flex align="center" justify="end" gap="lg" flex={1} minWidth={0}>
      <Flex align="center" gap="md" minWidth={0} overflow="hidden">
        {referencedSeries.map((series, seriesIndex) => (
          <Flex key={seriesIndex} align="center" gap="xs" minWidth={0}>
            <Text size="sm" variant="accent">
              {String.fromCharCode(65 + seriesIndex)}
            </Text>
            <Text size="sm" ellipsis>
              {isVisualizeEquation(series)
                ? stripEquationPrefix(series.yAxis)
                : series.yAxis}
            </Text>
          </Flex>
        ))}
      </Flex>
      <Flex align="center" gap="xs" flexShrink={0}>
        <Text size="sm" variant="accent">
          + − / *
        </Text>
        <Text size="sm">{t('operators')}</Text>
      </Flex>
    </Flex>
  );
}

function GroupByActionsComponent({
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
          />
        );
      })}
    </CMDKAction>
  );
}

const GroupByActions = memo(GroupByActionsComponent);

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
        labelSuffix:
          option.value === parsedFunction.arguments[0] ? (
            <QueryValue value={t('Current')} />
          ) : undefined,
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
  const location = useLocation();
  const organization = useOrganization();
  const setQueryParams = useSetQueryParams();
  const visualizes = useQueryParamsVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const sampleSortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const crossEvents = useQueryParamsCrossEvents();
  const [caseInsensitive] = useCaseInsensitivity();
  const [draftFilters, setDraftFilters] = useState(() => ({
    pendingRows: getFilterRows(query).length === 0 ? 1 : 0,
    query,
  }));
  const [draftCharts, setDraftCharts] = useState(() =>
    visualizes.map((visualize, id) => ({id, visualize}))
  );
  const [draftGroupBys, setDraftGroupBys] = useState<string[]>([...groupBys]);
  const [pendingGroupByRows, setPendingGroupByRows] = useState(
    groupBys.length === 0 ? 1 : 0
  );
  const [draftSampleSortBys, setDraftSampleSortBys] = useState<Sort[]>([
    ...sampleSortBys,
  ]);
  const [draftAggregateSortBys, setDraftAggregateSortBys] = useState<Sort[]>([
    ...aggregateSortBys,
  ]);

  useEffect(() => {
    if (!commandPaletteState.open) {
      setDraftFilters({
        pendingRows: getFilterRows(query).length === 0 ? 1 : 0,
        query,
      });
      setDraftCharts(visualizes.map((visualize, id) => ({id, visualize})));
      setDraftGroupBys([...groupBys]);
      setPendingGroupByRows(groupBys.length === 0 ? 1 : 0);
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

  const addSearchFilter = useCallback((filter: SearchFilter) => {
    setDraftFilters(current => {
      const nextQuery = addSearchFilterToQuery(current.query, filter);
      if (nextQuery === current.query) {
        return current;
      }
      return {
        pendingRows: Math.max(0, current.pendingRows - 1),
        query: nextQuery,
      };
    });
  }, []);
  const addGroupBy = useCallback((nextGroupBys: string[]) => {
    setDraftGroupBys(nextGroupBys);
    setPendingGroupByRows(count => Math.max(0, count - 1));
  }, []);

  const draftQuery = draftFilters.query;
  const draftMode = draftGroupBys.some(Boolean) ? Mode.AGGREGATE : Mode.SAMPLES;
  const draftVisualizes = draftCharts.map(chart => chart.visualize);
  const draftSortBys =
    draftMode === Mode.SAMPLES ? draftSampleSortBys : draftAggregateSortBys;
  const draftVisualizeFunctions = draftVisualizes.filter(isVisualizeFunction);
  const hasCrossEvents = defined(crossEvents) && crossEvents.length > 0;
  const setDraftSortBys =
    draftMode === Mode.SAMPLES ? setDraftSampleSortBys : setDraftAggregateSortBys;
  const sortBySummary = draftSortBys
    .map(sort => `${sort.field}, ${sort.kind}`)
    .join(', ');
  const updateVisualize = useCallback((chartId: number, nextVisualize: Visualize) => {
    setDraftCharts(currentCharts =>
      currentCharts.map(chart =>
        chart.id === chartId ? {...chart, visualize: nextVisualize} : chart
      )
    );
  }, []);
  const addDraftChart = (visualize: Visualize) => {
    setDraftCharts(currentCharts => [
      ...currentCharts,
      {
        id: currentCharts.reduce((maxId, chart) => Math.max(maxId, chart.id), -1) + 1,
        visualize,
      },
    ]);
  };
  return (
    <CMDKChainedActionScope>
      <CMDKAction display={{label: t('Commands')}}>
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
        {draftVisualizes.length < MAX_VISUALIZES && (
          <Fragment>
            <CMDKAction
              actionContext="add-chart"
              actionPanel={{
                context: 'add-chart',
                label: t('Add Chart'),
                order: MORE_ACTIONS_ORDER.addChart,
              }}
              display={{label: t('Add Chart')}}
              keywords={['add', 'chart', 'series', 'source', 'visualization']}
              onAction={() => addDraftChart(new VisualizeFunction(DEFAULT_VISUALIZATION))}
            />
            <CMDKAction
              actionContext="add-equation"
              actionPanel={{
                context: 'add-equation',
                label: t('Add Equation'),
                order: MORE_ACTIONS_ORDER.addEquation,
              }}
              display={{label: t('Add Equation')}}
              keywords={['add', 'chart', 'equation', 'series', 'visualization']}
              onAction={() => addDraftChart(new VisualizeEquation(EQUATION_PREFIX))}
            />
          </Fragment>
        )}
        <CMDKAction
          id={ADD_GROUP_BY_ACTION_ID}
          actionContext="group-by"
          display={{label: t('Add Group By')}}
          keywords={['add', 'group', 'by', 'attribute']}
          prompt={t('Search for attribute')}
        >
          <GroupByActions groupBys={draftGroupBys} setGroupBys={addGroupBy} />
        </CMDKAction>
        <CMDKAction
          actionPanel={{
            context: 'group-by',
            label: t('Add Group By'),
            only: true,
            order: MORE_ACTIONS_ORDER.addGroupBy,
          }}
          display={{label: t('Add Group By')}}
          onAction={() => setPendingGroupByRows(count => count + 1)}
        />
        <SpansFilterActions addSearchFilter={addSearchFilter} />
        <CMDKAction
          actionPanel={{
            context: 'filter',
            label: t('Add Filter By'),
            only: true,
            order: MORE_ACTIONS_ORDER.addFilter,
          }}
          display={{label: t('Add Filter By')}}
          onAction={() =>
            setDraftFilters(current => ({
              ...current,
              pendingRows: current.pendingRows + 1,
            }))
          }
        />
        {canReorderCharts(draftVisualizes) && (
          <CMDKAction
            actionContext="reorder-charts"
            actionPanel={{
              context: 'reorder-charts',
              label: t('Reorder Charts'),
              order: MORE_ACTIONS_ORDER.reorderCharts,
            }}
            display={{label: t('Reorder Charts')}}
            keywords={['reorder', 'move', 'charts', 'series']}
          >
            {draftCharts.map((chart, index) => {
              const {id: chartId, visualize} = chart;
              const id = `spans-reorder-chart-${chartId}`;

              return (
                <CMDKAction
                  key={id}
                  id={id}
                  display={{
                    label: t('Chart %s', String.fromCharCode(65 + chartId)),
                    trailingItem: (
                      <QueryValue
                        value={
                          isVisualizeEquation(visualize)
                            ? stripEquationPrefix(visualize.yAxis)
                            : visualize.yAxis
                        }
                      />
                    ),
                  }}
                  order={index}
                  onAction={() => {}}
                  onReorder={direction =>
                    setDraftCharts(currentCharts =>
                      reorderCharts(currentCharts, index, direction)
                    )
                  }
                />
              );
            })}
          </CMDKAction>
        )}
        {canCompareQueries(draftVisualizes) && (
          <CMDKAction
            disabled={hasCrossEvents}
            display={{label: t('Compare Queries')}}
            keywords={['compare', 'queries', 'charts']}
            to={generateExploreCompareRoute({
              organization,
              mode: draftMode,
              location,
              queries: draftVisualizeFunctions.map(visualize => ({
                query: draftQuery,
                groupBys: draftGroupBys,
                sortBys: draftSortBys,
                yAxes: [visualize.yAxis],
                chartType: visualize.chartType,
                caseInsensitive: caseInsensitive ? '1' : undefined,
              })),
            })}
            onAction={() =>
              trackAnalytics('trace_explorer.compare', {
                organization,
              })
            }
          />
        )}
        <SaveAsActions />
      </CMDKAction>
      <CMDKAction display={{label: t('Query')}}>
        {[...draftGroupBys, ...Array.from({length: pendingGroupByRows}, () => '')].map(
          (groupBy, index) => {
            const rowId = `spans-group-by-${index}`;

            return (
              <CMDKAction
                key={rowId}
                id={rowId}
                actionContext={`group-by:${index}`}
                display={{
                  label: t('Group By'),
                  trailingItem: <QueryValue value={groupBy} />,
                }}
                keywords={['group', 'by', 'attribute', groupBy]}
                order={QUERY_ACTION_ORDER.groupBy + index}
                targetAction={ADD_GROUP_BY_ACTION_ID}
              />
            );
          }
        )}
        <TraceItemFilterRows
          orderStart={QUERY_ACTION_ORDER.filter}
          pendingRows={draftFilters.pendingRows}
          summary={draftQuery}
          targetAction={ADD_FILTER_ACTION_ID}
        />
        <CMDKAction
          id="spans-sort"
          display={{
            label: t('Sort by'),
            trailingItem: <QueryValue value={sortBySummary} />,
          }}
          order={QUERY_ACTION_ORDER.sort}
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
      {draftCharts.map(({id: chartId, visualize}, index) => (
        <CMDKAction
          key={`series-details-${chartId}`}
          id={`spans-series-details-${chartId}`}
          actionContext={`chart:${chartId}`}
          display={{label: t('Chart %s', String.fromCharCode(65 + index))}}
        >
          {canDeleteChart(draftCharts) && (
            <CMDKAction
              actionPanel={{
                context: `chart:${chartId}`,
                label: t('Delete Chart'),
                only: true,
                order: MORE_ACTIONS_ORDER.deleteChart,
              }}
              display={{label: t('Delete Chart')}}
              keywords={['delete', 'remove', 'chart', 'series']}
              onAction={() =>
                setDraftCharts(currentCharts => deleteChart(currentCharts, chartId))
              }
            />
          )}
          <SeriesActions
            chartId={chartId}
            index={index}
            seriesId={`spans-series-${chartId}`}
            updateVisualize={updateVisualize}
            visualize={visualize}
            visualizes={draftVisualizes}
          />
        </CMDKAction>
      ))}
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
