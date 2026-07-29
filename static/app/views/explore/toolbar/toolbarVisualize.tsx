import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {IconHide} from 'sentry/icons/iconHide';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX, parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
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

  const conditionalAggregate = useMemo(
    () => parseConditionalAggregate(visualize.yAxis),
    [visualize.yAxis]
  );

  // Dropdowns operate on the base aggregate (without `_if` / filter).
  const parsedFunction = useMemo(() => {
    if (!conditionalAggregate) {
      return parseFunction(visualize.yAxis);
    }
    return {
      name: conditionalAggregate.name,
      arguments: conditionalAggregate.arguments,
    };
  }, [conditionalAggregate, visualize.yAxis]);

  const fieldOptions = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const yAxis = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: parsedFunction?.name,
          oldArguments: parsedFunction?.arguments,
        });
        const filter = supportsConditionalAggregateFilter(option.value)
          ? (conditionalAggregate?.filter ?? '')
          : '';
        onReplace(
          visualize.replace({
            yAxis: applyConditionalFilter(yAxis, filter),
          })
        );
      }
    },
    [conditionalAggregate?.filter, onReplace, parsedFunction, visualize]
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
              filter: conditionalAggregate?.filter ?? '',
            }),
          })
        );
      }
    },
    [conditionalAggregate?.filter, onReplace, parsedFunction, visualize]
  );

  const onFilterSearch = useCallback(
    (filter: string) => {
      if (!parsedFunction) {
        return;
      }
      onReplace(
        visualize.replace({
          yAxis: buildConditionalAggregate({
            name: parsedFunction.name,
            arguments: parsedFunction.arguments,
            filter,
          }),
        })
      );
    },
    [onReplace, parsedFunction, visualize]
  );

  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects: selection.projects,
    initialQuery: conditionalAggregate?.filter ?? '',
    onSearch: onFilterSearch,
    searchSource: 'explore',
    placeholder: t('Filter spans for this series'),
  });

  const showFilterSearchBar = supportsConditionalAggregateFilter(
    parsedFunction?.name ?? ''
  );

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
          <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />
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
