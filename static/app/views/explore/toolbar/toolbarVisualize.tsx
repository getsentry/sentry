import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {IconHide} from 'sentry/icons/iconHide';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  isVisualizeEquation,
  MAX_VISUALIZES,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  applyConditionalFilter,
  buildConditionalAggregate,
  CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE,
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
  const addChart = useCallback(() => {
    const newVisualizes = [
      ...visualizes,
      new VisualizeFunction(DEFAULT_VISUALIZATION),
    ].map(visualize => visualize.serialize());
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const addEquation = useCallback(() => {
    const newVisualizes = [...visualizes, new VisualizeEquation(EQUATION_PREFIX)].map(
      visualize => visualize.serialize()
    );
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const replaceOverlay = (group: number, newVisualize: Visualize) => {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === group) {
        return newVisualize.serialize();
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  };

  const toggleVisibility = (group: number) => {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === group) {
        visualize = visualize.replace({visible: !visualize.visible});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  };

  const setVisualizesWithOp = useCallback(
    (columns: Visualize[]) => {
      setVisualizes(columns.map(v => v.serialize()));
    },
    [setVisualizes]
  );

  return (
    <DragNDropContext columns={[...visualizes]} setColumns={setVisualizesWithOp}>
      {({editableColumns, deleteColumnAtIndex}) => (
        <ToolbarSection data-test-id="section-visualizes">
          <ToolbarVisualizeHeader />
          {editableColumns.map((column, i) => {
            const visualize = column.column;
            const dragColumnId = editableColumns.length > 1 ? column.id : undefined;
            const label = (
              <VisualizeLabel
                index={i}
                visualize={visualize}
                onClick={() => toggleVisibility(i)}
              />
            );
            const onDelete =
              editableColumns.length > 1 ? () => deleteColumnAtIndex(i) : undefined;

            if (isVisualizeEquation(visualize)) {
              return (
                <VisualizeEquationInput
                  key={column.uniqueId}
                  dragColumnId={dragColumnId}
                  onDelete={onDelete}
                  onReplace={newVisualize => replaceOverlay(i, newVisualize)}
                  visualize={visualize}
                  label={label}
                />
              );
            }

            return (
              <ToolbarVisualizeItem
                key={column.uniqueId}
                dragColumnId={dragColumnId}
                onDelete={onDelete}
                onReplace={newVisualize => replaceOverlay(i, newVisualize)}
                visualize={visualize}
                label={label}
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
  onReplace: (visualize: Visualize) => void;
  visualize: Visualize;
  dragColumnId?: number;
  onDelete?: () => void;
}

function ToolbarVisualizeItem({
  dragColumnId,
  label,
  onDelete,
  onReplace,
  visualize,
}: VisualizeDropdownProps) {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 200);
  const {selection} = usePageFilters();
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

  const aggregateOptions = useMemo(
    () =>
      ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
        return {
          label: aggregate,
          value: aggregate,
          textValue: aggregate,
        };
      }),
    []
  );

  // The dropdowns operate on the base aggregate, with the `_if` combinator and its
  // filter argument stripped off.
  const parsedFunction = useMemo(
    () => parseConditionalAggregate(visualize.yAxis),
    [visualize.yAxis]
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

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const yAxis = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: parsedFunction?.name,
          oldArguments: parsedFunction?.arguments,
        });
        onReplace(
          visualize.replace({
            yAxis: supportsConditionalAggregateFilter(option.value)
              ? applyConditionalFilter(yAxis, filter)
              : yAxis,
          })
        );
      }
    },
    [filter, onReplace, parsedFunction, visualize]
  );

  const onChangeArgument = useCallback(
    (index: number, option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        let args = cloneDeep(parsedFunction?.arguments);
        if (args) {
          args[index] = option.value;
        } else {
          args = [option.value];
        }
        onReplace(
          visualize.replace({
            yAxis: buildConditionalAggregate({
              name: parsedFunction?.name ?? '',
              arguments: args,
              filter,
            }),
          })
        );
      }
    },
    [filter, onReplace, parsedFunction, visualize]
  );

  const onFilterSearch = useCallback(
    (newFilter: string) => {
      if (!parsedFunction) {
        return;
      }
      onReplace(
        visualize.replace({
          yAxis: buildConditionalAggregate({
            name: parsedFunction.name,
            arguments: parsedFunction.arguments,
            filter: newFilter,
          }),
        })
      );
    },
    [onReplace, parsedFunction, visualize]
  );

  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects: selection.projects,
    initialQuery: filter,
    onSearch: onFilterSearch,
    searchSource: 'explore-conditional-aggregate',
    placeholder: t('Filter spans for this series'),
    // Attribute-only, same as metrics / samples-mode search: never offer visualize
    // aggregates (p95, count, …) as series-filter keys.
    supportedAggregates: [],
  });

  const showFilterSearchBar =
    hasConditionalAggregates &&
    supportsConditionalAggregateFilter(parsedFunction?.name ?? '');

  return (
    <ToolbarVisualizeDropdown
      dragColumnId={dragColumnId}
      aggregateOptions={aggregateOptions}
      fieldOptions={fieldOptions}
      onChangeAggregate={onChangeAggregate}
      onChangeArgument={onChangeArgument}
      onDelete={onDelete}
      parsedFunction={parsedFunction}
      label={label}
      loading={numberTagsLoading || stringTagsLoading || booleanTagsLoading}
      onSearch={setSearch}
      onClose={() => setSearch(undefined)}
      filterSearchBar={
        showFilterSearchBar ? (
          <TraceItemSearchQueryBuilder
            {...spanSearchQueryBuilderProps}
            showSearchIcon={false}
            // This spans toolbar clips menus that are not portaled, and the full width
            // filter key menu anchors itself inside the bar, so it has to be turned off for
            // portaling to cover every menu.
            portalTarget={document.body}
            disableFullWidthFilterKeyMenu
            // Same "Invalid key" UX as metrics: aggregates are not valid series-filter
            // keys (metrics gets this from validate; we list visualize aggregates).
            invalidFilterKeys={[
              ...(spanSearchQueryBuilderProps.invalidFilterKeys ?? []),
              ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
            ]}
            invalidMessages={{
              [InvalidReason.INVALID_KEY]: CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE,
            }}
          />
        ) : undefined
      }
    />
  );
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
