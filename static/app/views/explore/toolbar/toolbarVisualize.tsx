import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';
import cloneDeep from 'lodash/cloneDeep';

import {Badge} from '@sentry/scraps/badge';
import {
  CompositeSelect,
  TriggerLabel,
  type SelectKey,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconHide} from 'sentry/icons/iconHide';
import {t, tn} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES, FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConditionalAggregateFilterBar} from 'sentry/views/explore/components/conditionalAggregateFilterBar';
import {
  ToolbarFooter,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ToolbarVisualizeAddChart,
  ToolbarVisualizeAddEquation,
  ToolbarVisualizeDropdown,
  ToolbarVisualizeHeader,
} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {VisualizeEquation as VisualizeEquationInput} from 'sentry/views/explore/components/toolbar/toolbarVisualize/visualizeEquation';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_AGGREGATE,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  createChartGroup,
  groupVisualizes,
  isVisualizeEquation,
  isVisualizeFunction,
  MAX_VISUALIZES,
  serializeVisualizes,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {
  SHARED_CHART_AGGREGATE_REGIONS,
  SHARED_CHART_AGGREGATES,
} from 'sentry/views/explore/spans/sharedChartAggregates';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  applyConditionalFilter,
  buildConditionalAggregate,
  parseConditionalAggregate,
  supportsConditionalAggregateFilter,
} from 'sentry/views/explore/utils/conditionalAggregate';

interface ToolbarVisualizeProps {
  allowEquations: boolean;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  visualizes: readonly Visualize[];
}

export function ToolbarVisualize({
  allowEquations,
  setVisualizes,
  visualizes,
}: ToolbarVisualizeProps) {
  // Each row in the toolbar is one chart, which can plot several aggregates.
  const charts = useMemo(
    () => groupVisualizes(visualizes).map(group => group.visualizes),
    [visualizes]
  );

  const setCharts = useCallback(
    (newCharts: Visualize[][]) => {
      setVisualizes(serializeVisualizes(newCharts.flat()));
    },
    [setVisualizes]
  );

  const addChart = useCallback(() => {
    setCharts([...charts, [new VisualizeFunction(DEFAULT_VISUALIZATION)]]);
  }, [charts, setCharts]);

  const addEquation = useCallback(() => {
    setCharts([...charts, [new VisualizeEquation(EQUATION_PREFIX)]]);
  }, [charts, setCharts]);

  const replaceChart = (index: number, newChart: Visualize[]) => {
    setCharts(charts.map((chart, i) => (i === index ? newChart : chart)));
  };

  const toggleVisibility = (index: number) => {
    setCharts(
      charts.map((chart, i) =>
        i === index
          ? chart.map(visualize => visualize.replace({visible: !visualize.visible}))
          : chart
      )
    );
  };

  return (
    <DragNDropContext columns={charts} setColumns={setCharts}>
      {({editableColumns, deleteColumnAtIndex}) => (
        <ToolbarSection data-test-id="section-visualizes">
          <ToolbarVisualizeHeader />
          {editableColumns.map((column, i) => {
            const chart = column.column;
            const visualize = chart[0]!;
            const isOnlyChart = editableColumns.length === 1;
            const canReset = isOnlyChart && !isDefaultChart(chart);
            const onDelete = isOnlyChart
              ? canReset
                ? () => replaceChart(i, [new VisualizeFunction(DEFAULT_VISUALIZATION)])
                : undefined
              : () => deleteColumnAtIndex(i);

            const rowProps = {
              dragColumnId: isOnlyChart ? undefined : column.id,
              onDelete,
              deleteLabel: canReset ? t('Clear Visualize') : undefined,
              label: (
                <VisualizeLabel
                  index={i}
                  visualize={visualize}
                  onClick={() => toggleVisibility(i)}
                />
              ),
            };

            return isVisualizeEquation(visualize) ? (
              <VisualizeEquationInput
                key={column.uniqueId}
                {...rowProps}
                visualize={visualize}
                onReplace={newVisualize => replaceChart(i, [newVisualize])}
              />
            ) : (
              <ToolbarVisualizeItem
                key={column.uniqueId}
                {...rowProps}
                visualizes={chart}
                onReplace={newChart => replaceChart(i, newChart)}
                maxAggregates={MAX_VISUALIZES - (visualizes.length - chart.length)}
              />
            );
          })}
          <ToolbarFooter>
            <ToolbarVisualizeAddChart
              add={addChart}
              disabled={visualizes.length >= MAX_VISUALIZES}
            />
            {allowEquations && (
              <ToolbarVisualizeAddEquation
                add={addEquation}
                disabled={visualizes.length >= MAX_VISUALIZES}
              />
            )}
          </ToolbarFooter>
        </ToolbarSection>
      )}
    </DragNDropContext>
  );
}

interface VisualizeDropdownProps {
  label: ReactNode;
  /**
   * The most aggregates this chart can plot without exceeding the limit on
   * aggregates across all charts.
   */
  maxAggregates: number;
  onReplace: (visualizes: Visualize[]) => void;
  /**
   * The visualizes plotted on this chart. They share the same arguments and
   * filter, only the aggregate differs.
   */
  visualizes: Visualize[];
  deleteLabel?: string;
  dragColumnId?: number;
  onDelete?: () => void;
}

function ToolbarVisualizeItem({
  dragColumnId,
  label,
  maxAggregates,
  onDelete,
  deleteLabel,
  onReplace,
  visualizes,
}: VisualizeDropdownProps) {
  const visualize = visualizes[0]!;
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [debouncedSearch] = useDebouncedValue(search, {wait: 200});
  const organization = useOrganization();
  const hasConditionalAggregates = organization.features.includes(
    'explore-conditional-aggregates'
  );

  const {attributes: stringTags, isLoading: stringTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'string'
  );
  const {attributes: numberTags, isLoading: numberTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'number'
  );
  const {attributes: booleanTags, isLoading: booleanTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'boolean'
  );

  // The dropdowns operate on the base aggregate, with the `_if` combinator and its
  // filter argument stripped off.
  const parsedFunction = useMemo(
    () => parseConditionalAggregate(visualize.yAxis),
    [visualize.yAxis]
  );

  const selectedAggregates = useMemo(
    () =>
      visualizes
        .map(v => parseConditionalAggregate(v.yAxis)?.name)
        .filter((name): name is string => defined(name)),
    [visualizes]
  );

  const fieldOptions = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  // Filters only survive a swap to another aggregate that supports them, and are dropped
  // entirely while the feature is off so that toggling it never leaves a stale filter.
  const filter = useMemo(
    () => (hasConditionalAggregates ? (parsedFunction?.filter ?? '') : ''),
    [hasConditionalAggregates, parsedFunction?.filter]
  );

  const onChangeAggregates = useCallback(
    (newAggregates: string[]) => {
      // Clearing the selection falls back to the default aggregate, like the
      // Metrics aggregate picker, so a chart always plots something.
      const aggregates = newAggregates.length
        ? newAggregates
        : [DEFAULT_VISUALIZATION_AGGREGATE];
      const chartGroup =
        aggregates.length > 1 ? (visualize.chartGroup ?? createChartGroup()) : null;
      onReplace(
        aggregates.map(aggregate => {
          const yAxis = updateVisualizeAggregate({
            newAggregate: aggregate,
            oldAggregate: parsedFunction?.name,
            oldArguments: parsedFunction?.arguments,
          });
          return visualize.replace({
            yAxis: supportsConditionalAggregateFilter(aggregate)
              ? applyConditionalFilter(yAxis, filter)
              : yAxis,
            chartGroup,
          });
        })
      );
    },
    [filter, onReplace, parsedFunction, visualize]
  );

  const onChangeArgument = useCallback(
    (index: number, option: SelectOption<SelectKey>) => {
      if (typeof option.value !== 'string') {
        return;
      }
      const value = option.value;
      onReplace(
        visualizes.map(v => {
          const parsed = parseConditionalAggregate(v.yAxis);
          const args = cloneDeep(parsed?.arguments) ?? [];
          args[index] = value;
          return v.replace({
            yAxis: buildConditionalAggregate({
              name: parsed?.name ?? '',
              arguments: args,
              filter,
            }),
          });
        })
      );
    },
    [filter, onReplace, visualizes]
  );

  const onFilterSearch = useCallback(
    (newFilter: string) => {
      onReplace(
        visualizes.map(v => {
          const parsed = parseConditionalAggregate(v.yAxis);
          if (!parsed) {
            return v;
          }
          return v.replace({
            yAxis: buildConditionalAggregate({
              name: parsed.name,
              arguments: parsed.arguments,
              filter: newFilter,
            }),
          });
        })
      );
    },
    [onReplace, visualizes]
  );

  const showFilterSearchBar =
    hasConditionalAggregates &&
    supportsConditionalAggregateFilter(parsedFunction?.name ?? '');

  return (
    <ToolbarVisualizeDropdown
      dragColumnId={dragColumnId}
      aggregateSelect={
        <AggregateMultiSelect
          maxAggregates={maxAggregates}
          onChange={onChangeAggregates}
          value={selectedAggregates}
        />
      }
      fieldOptions={fieldOptions}
      onChangeArgument={onChangeArgument}
      onDelete={onDelete}
      deleteLabel={deleteLabel}
      parsedFunction={parsedFunction}
      label={label}
      loading={numberTagsLoading || stringTagsLoading || booleanTagsLoading}
      onSearch={setSearch}
      onClose={() => setSearch(undefined)}
      filterSearchBar={
        showFilterSearchBar ? (
          <ConditionalAggregateFilterBar
            menuPresentation="panel"
            initialQuery={filter}
            onSearch={onFilterSearch}
            searchSource="explore-conditional-aggregate"
          />
        ) : undefined
      }
    />
  );
}

const SINGLE_SELECT_AGGREGATES = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.filter(
  aggregate => !SHARED_CHART_AGGREGATES.includes(aggregate)
);

interface AggregateMultiSelectProps {
  maxAggregates: number;
  onChange: (aggregates: string[]) => void;
  value: string[];
}

function AggregateMultiSelect({
  maxAggregates,
  onChange,
  value,
}: AggregateMultiSelectProps) {
  const selected = new Set(value);
  const multiSelectValue = SHARED_CHART_AGGREGATES.filter(aggregate =>
    selected.has(aggregate)
  );
  const singleSelectValue = SINGLE_SELECT_AGGREGATES.find(aggregate =>
    selected.has(aggregate)
  );
  const isAtLimit = multiSelectValue.length >= maxAggregates;
  const isDefaultSelection =
    value.length === 1 && value[0] === DEFAULT_VISUALIZATION_AGGREGATE;

  const toOption = (aggregate: string): SelectOption<string> => ({
    label: aggregate,
    value: aggregate,
    textValue: aggregate,
    trailingItems: <TypeBadge kind={FieldKind.FUNCTION} />,
  });

  const onChangeRegion = (
    regionAggregates: readonly string[],
    options: Array<SelectOption<string>>
  ) => {
    // Selections in the other multi-select region are kept, as they plot on
    // the same Y axis. The order is fixed so the legend doesn't depend on the
    // order aggregates were clicked in.
    const regionSelection = new Set(options.map(option => option.value));
    onChange(
      SHARED_CHART_AGGREGATES.filter(aggregate =>
        regionAggregates.includes(aggregate)
          ? regionSelection.has(aggregate)
          : multiSelectValue.includes(aggregate)
      )
    );
  };

  return (
    <AggregateCompositeSelect
      menuHeaderTrailingItems={
        isDefaultSelection
          ? undefined
          : () => <CompositeSelect.ClearButton onClick={() => onChange([])} />
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} style={{width: '100%'}}>
          <TriggerLabel>{value[0] ?? t('None')}</TriggerLabel>
          {value.length > 1 && (
            <Badge variant="muted" style={{marginLeft: 4, flexShrink: 0, top: 'auto'}}>
              {`+${value.length - 1}`}
            </Badge>
          )}
        </OverlayTrigger.Button>
      )}
    >
      {[
        ...SHARED_CHART_AGGREGATE_REGIONS.map(region => (
          <CompositeSelect.Region
            key={region.key}
            label={region.label}
            multiple
            options={region.aggregates.map(aggregate => {
              const disabled = isAtLimit && !selected.has(aggregate);
              return {
                ...toOption(aggregate),
                disabled,
                tooltip: disabled
                  ? tn(
                      'You can plot at most %s aggregate',
                      'You can plot at most %s aggregates',
                      MAX_VISUALIZES
                    )
                  : undefined,
              };
            })}
            value={multiSelectValue.filter(aggregate =>
              region.aggregates.includes(aggregate)
            )}
            onChange={options => onChangeRegion(region.aggregates, options)}
          />
        )),
        <CompositeSelect.Region
          key="other"
          label={t('Other')}
          options={SINGLE_SELECT_AGGREGATES.map(toOption)}
          value={singleSelectValue}
          onChange={option => onChange([option.value])}
        />,
      ]}
    </AggregateCompositeSelect>
  );
}

const AggregateCompositeSelect = styled(CompositeSelect)`
  width: 100px;
  flex-shrink: 0;

  > button {
    width: 100%;
  }
`;

function isDefaultChart(visualizes: Visualize[]): boolean {
  return visualizes.length === 1 && isDefaultVisualize(visualizes[0]!);
}

function isDefaultVisualize(visualize: Visualize): boolean {
  return isVisualizeFunction(visualize) && visualize.yAxis === DEFAULT_VISUALIZATION;
}

interface VisualizeLabelProps {
  index: number;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
}

export function getFunctionLabel(index: number) {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function getEquationLabel(index: number) {
  return `ƒ${index}`;
}

export function getVisualizeLabel(labelIndex: number, isEquation: boolean): string {
  return isEquation ? getEquationLabel(labelIndex) : getFunctionLabel(labelIndex);
}

export function VisualizeLabel({index, onClick, visualize}: VisualizeLabelProps) {
  const label = visualize.visible ? getFunctionLabel(index) : <IconHide />;

  return <Label onClick={onClick}>{label}</Label>;
}

const Label = styled('div')`
  cursor: pointer;
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  color: ${p => p.theme.tokens.content.accent};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  width: 24px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
`;
