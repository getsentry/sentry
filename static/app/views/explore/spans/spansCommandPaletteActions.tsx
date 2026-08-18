import {Fragment, useEffect, useState} from 'react';

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
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  EQUATION_PREFIX,
  parseFunction,
  prettifyParsedFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
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
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSpansSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
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
  isVisualizeEquation,
  MAX_VISUALIZES,
  type Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getMetricAlertsUpsellTooltip} from 'sentry/views/explore/utils/saveAsAlertMenuItem';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

function SaveAsActions() {
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
  index,
  onChange,
  seriesId,
  visualize,
  visualizes,
}: {
  index: number;
  onChange: (visualize: Visualize) => void;
  seriesId: string;
  visualize: Visualize;
  visualizes: readonly Visualize[];
}) {
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
            onChange(visualize.replace({yAxis: `${EQUATION_PREFIX}${value}`})),
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

function GroupByActions({
  appliedGroupBys,
  groupBys,
  setGroupBys,
}: {
  appliedGroupBys: readonly string[];
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
        const selectedGroupBys = groupBys.filter(Boolean);

        return (
          <CMDKAction
            key={option.value}
            display={{
              label: option.textValue ?? option.value,
              labelSuffix: appliedGroupBys.includes(option.value) ? (
                <QueryValue value={t('Current')} />
              ) : undefined,
              trailingItem:
                typeof option.trailingItems === 'function'
                  ? option.trailingItems({
                      disabled: false,
                      isFocused: false,
                      isSelected,
                    })
                  : option.trailingItems,
            }}
            isSelected={isSelected}
            keywords={[option.value]}
            onAction={() => {}}
            onMultiSelect={() => {
              setGroupBys(
                isSelected
                  ? groupBys.filter(groupBy => groupBy !== option.value)
                  : [...groupBys.filter(Boolean), option.value]
              );
            }}
          >
            {selectedGroupBys.length > 1 ? (
              <CMDKAction display={{label: t('Order by')}}>
                {selectedGroupBys.map((selectedGroupBy, selectedIndex) => {
                  const selectedOption = options.find(
                    candidate => candidate.value === selectedGroupBy
                  );

                  return (
                    <CMDKAction
                      key={selectedGroupBy}
                      display={{
                        label: selectedOption?.textValue ?? selectedGroupBy,
                      }}
                      order={selectedIndex}
                      onAction={() => {}}
                      onReorder={direction => {
                        const nextIndex =
                          direction === 'up' ? selectedIndex - 1 : selectedIndex + 1;
                        if (nextIndex < 0 || nextIndex >= selectedGroupBys.length) {
                          return;
                        }

                        const reorderedGroupBys = [...selectedGroupBys];
                        const nextGroupBy = reorderedGroupBys[nextIndex];
                        if (nextGroupBy === undefined) {
                          return;
                        }
                        [reorderedGroupBys[selectedIndex], reorderedGroupBys[nextIndex]] =
                          [nextGroupBy, selectedGroupBy];
                        setGroupBys(reorderedGroupBys);
                      }}
                    />
                  );
                })}
              </CMDKAction>
            ) : null}
          </CMDKAction>
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
              display={{label: t('Add Chart')}}
              keywords={['add', 'chart', 'series', 'source', 'visualization']}
              onAction={() =>
                setDraftVisualizes(currentVisualizes => [
                  ...currentVisualizes,
                  new VisualizeFunction(DEFAULT_VISUALIZATION),
                ])
              }
            />
            <CMDKAction
              display={{label: t('Add Equation')}}
              keywords={['add', 'chart', 'equation', 'series', 'visualization']}
              onAction={() =>
                setDraftVisualizes(currentVisualizes => [
                  ...currentVisualizes,
                  new VisualizeEquation(EQUATION_PREFIX),
                ])
              }
            />
          </Fragment>
        )}
        <SaveAsActions />
      </CMDKAction>
      <CMDKAction display={{label: t('Query')}}>
        <CMDKAction
          display={{
            label: groupBySummary ? t('Group by') : t('Add Group by'),
            trailingItem: <QueryValue value={groupBySummary} />,
          }}
          prompt={t('Search for attribute')}
        >
          <GroupByActions
            appliedGroupBys={groupBys}
            groupBys={draftGroupBys}
            setGroupBys={setDraftGroupBys}
          />
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
      {draftVisualizes.map((visualize, index) => (
        <CMDKAction
          key={`series-details-${index}`}
          id={`spans-series-details-${index}`}
          display={{label: t('Series %s', String.fromCharCode(65 + index))}}
        >
          <SeriesActions
            index={index}
            visualize={visualize}
            visualizes={draftVisualizes}
            onChange={nextVisualize => updateVisualize(index, nextVisualize)}
            seriesId={`spans-series-${index}`}
          />
          <CMDKAction
            disabled={draftVisualizes.length === 1}
            display={{label: t('Delete Series')}}
            keywords={['delete', 'remove', 'series']}
            onAction={() =>
              setDraftVisualizes(currentVisualizes =>
                currentVisualizes.filter((_, visualizeIndex) => visualizeIndex !== index)
              )
            }
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
