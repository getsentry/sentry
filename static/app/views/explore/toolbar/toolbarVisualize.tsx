import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {IconHide} from '@sentry/icons/hide';
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
  DEFAULT_VISUALIZATION_FIELD,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  useDatasetFormulas,
  type SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
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
import {stripNamePrefix} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {
  SHARED_CHART_AGGREGATE_REGIONS,
  SHARED_CHART_AGGREGATES,
  hasMultiAggregateCharts,
} from 'sentry/views/explore/spans/sharedChartAggregates';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  applyConditionalFilter,
  buildConditionalAggregate,
  supportsConditionalAggregateFilter,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {
  buildFormulaYAxis,
  findFormula,
  getFormulaColumnFunction,
} from 'sentry/views/explore/utils/formulaAggregate';
import {getFunctionLabel} from 'sentry/views/explore/utils/getFunctionLabel';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/parseConditionalAggregate';

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
  const formulas = useDatasetFormulas('spans');

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
                formulas={formulas}
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
  formulas: readonly SavedFormula[];
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
  formulas,
  label,
  maxAggregates,
  onDelete,
  deleteLabel,
  onReplace,
  visualizes,
}: VisualizeDropdownProps) {
  const visualize = visualizes[0]!;
  const organization = useOrganization();
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [debouncedSearch] = useDebouncedValue(search, {wait: 200});
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
  const formula = findFormula(formulas, parsedFunction?.name);

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
    parsedFunction:
      formula && parsedFunction
        ? getFormulaColumnFunction(formula, parsedFunction)
        : parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const filter = parsedFunction?.filter ?? '';

  const onChangeAggregates = useCallback(
    (newAggregates: string[]) => {
      // Clearing the selection falls back to the default aggregate, like the
      // Metrics aggregate picker, so a chart always plots something.
      const aggregates = newAggregates.length
        ? newAggregates
        : [DEFAULT_VISUALIZATION_AGGREGATE];
      // Formulas are picked on their own, never alongside other aggregates.
      const newFormula =
        aggregates.length === 1 ? findFormula(formulas, aggregates[0]) : undefined;
      if (newFormula) {
        const formulaYAxis = buildFormulaYAxis(newFormula, DEFAULT_VISUALIZATION_FIELD);
        if (formulaYAxis) {
          onReplace([visualize.replace({yAxis: formulaYAxis, chartGroup: null})]);
        }
        return;
      }
      // Formula arguments don't map onto built in aggregates, so switch as if from the default.
      const previous = formula
        ? parseConditionalAggregate(DEFAULT_VISUALIZATION)
        : parsedFunction;
      const chartGroup =
        aggregates.length > 1 ? (visualize.chartGroup ?? createChartGroup()) : null;
      onReplace(
        aggregates.map(aggregate => {
          const yAxis = updateVisualizeAggregate({
            newAggregate: aggregate,
            oldAggregate: previous?.name,
            oldArguments: previous?.arguments,
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
    [filter, formula, formulas, onReplace, parsedFunction, visualize]
  );

  const onChangeArgument = useCallback(
    (index: number, value: string) => {
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

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        onChangeAggregates([option.value]);
      }
    },
    [onChangeAggregates]
  );

  const multiAggregateCharts = hasMultiAggregateCharts(organization);
  const showFilterSearchBar = supportsConditionalAggregateFilter(
    parsedFunction?.name ?? ''
  );

  return (
    <ToolbarVisualizeDropdown
      dragColumnId={dragColumnId}
      aggregateSelect={
        multiAggregateCharts ? (
          <AggregateMultiSelect
            formulas={formulas}
            maxAggregates={maxAggregates}
            onChange={onChangeAggregates}
            value={selectedAggregates}
          />
        ) : undefined
      }
      aggregateOptions={AGGREGATE_OPTIONS}
      onChangeAggregate={onChangeAggregate}
      fieldOptions={fieldOptions}
      formulaDefaultColumn={DEFAULT_VISUALIZATION_FIELD}
      formulas={formulas}
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

const AGGREGATE_OPTIONS: Array<SelectOption<string>> =
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
    label: aggregate,
    value: aggregate,
    textValue: aggregate,
  }));

const SINGLE_SELECT_AGGREGATES = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.filter(
  aggregate => !SHARED_CHART_AGGREGATES.includes(aggregate)
);

interface AggregateMultiSelectProps {
  formulas: readonly SavedFormula[];
  maxAggregates: number;
  onChange: (aggregates: string[]) => void;
  value: string[];
}

function AggregateMultiSelect({
  formulas,
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
  const selectedFormula = formulas.find(formula => selected.has(formula.name));
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
    // Like the Metrics aggregate picker, picking in one region replaces the
    // selection made in any other region. The order is fixed so the legend
    // doesn't depend on the order aggregates were clicked in.
    const regionSelection = new Set(options.map(option => option.value));
    onChange(regionAggregates.filter(aggregate => regionSelection.has(aggregate)));
  };

  return (
    <AggregateCompositeSelect
      fullWidth={defined(selectedFormula)}
      menuHeaderTrailingItems={
        isDefaultSelection
          ? undefined
          : () => <CompositeSelect.ClearButton onClick={() => onChange([])} />
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} style={{width: '100%'}}>
          <TriggerLabel>
            {selectedFormula
              ? stripNamePrefix(selectedFormula.name)
              : (value[0] ?? t('None'))}
          </TriggerLabel>
          {value.length > 1 && (
            <Badge variant="muted" style={{marginLeft: 4, flexShrink: 0, top: 'auto'}}>
              {`+${value.length - 1}`}
            </Badge>
          )}
        </OverlayTrigger.Button>
      )}
    >
      {[
        ...SHARED_CHART_AGGREGATE_REGIONS.map(region => {
          const regionValue = multiSelectValue.filter(aggregate =>
            region.aggregates.includes(aggregate)
          );
          // Picking in another region replaces the selection, so only the
          // region's own selection counts towards the limit.
          const isAtLimit = regionValue.length >= maxAggregates;
          return (
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
              value={regionValue}
              onChange={options => onChangeRegion(region.aggregates, options)}
            />
          );
        }),
        <CompositeSelect.Region
          key="other"
          label={t('Other')}
          options={SINGLE_SELECT_AGGREGATES.map(toOption)}
          value={singleSelectValue}
          onChange={option => onChange([option.value])}
        />,
        ...(formulas.length
          ? [
              <CompositeSelect.Region
                key="formulas"
                label={t('Formulas')}
                options={formulas.map(formula => ({
                  label: stripNamePrefix(formula.name),
                  value: formula.name,
                  textValue: formula.name,
                  details: formula.description,
                  disabled:
                    buildFormulaYAxis(formula, DEFAULT_VISUALIZATION_FIELD) === null,
                  trailingItems: <TypeBadge kind={FieldKind.FUNCTION} />,
                }))}
                value={selectedFormula?.name}
                onChange={option => onChange([option.value])}
              />,
            ]
          : []),
      ]}
    </AggregateCompositeSelect>
  );
}

const AggregateCompositeSelect = styled(CompositeSelect, {
  shouldForwardProp: prop => prop !== 'fullWidth',
})<{fullWidth: boolean}>`
  ${p =>
    p.fullWidth
      ? 'flex: 1 1; min-width: 0; width: 100%;'
      : 'width: 100px; flex-shrink: 0;'}

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
