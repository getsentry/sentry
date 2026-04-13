import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';

import {IconHide} from 'sentry/icons/iconHide';
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
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  isVisualizeEquation,
  MAX_VISUALIZES,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

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

  const replaceOverlay = useCallback(
    (group: number, newVisualize: Visualize) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          return newVisualize.serialize();
        }
        return visualize.serialize();
      });
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const toggleVisibility = useCallback(
    (group: number) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          visualize = visualize.replace({visible: !visualize.visible});
        }
        return visualize.serialize();
      });
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const handleOnDelete = useCallback(
    (group: number) => {
      const newVisualizes = visualizes
        .toSpliced(group, 1)
        .map(visualize => visualize.serialize());
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const setVisualizesWithOp = useCallback(
    (columns: Visualize[]) => {
      setVisualizes(columns.map(v => v.serialize()));
    },
    [setVisualizes]
  );

  return (
    <DragNDropContext columns={[...visualizes]} setColumns={setVisualizesWithOp}>
      {({editableColumns}) => (
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
              editableColumns.length > 1 ? () => handleOnDelete(i) : undefined;

            if (isVisualizeEquation(visualize)) {
              return (
                <VisualizeEquationInput
                  key={column.id}
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
                key={column.id}
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

  const parsedFunction = useMemo(() => parseFunction(visualize.yAxis), [visualize.yAxis]);

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
        onReplace(visualize.replace({yAxis}));
      }
    },
    [onReplace, parsedFunction, visualize]
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
        const yAxis = `${parsedFunction?.name}(${args.join(',')})`;
        onReplace(visualize.replace({yAxis}));
      }
    },
    [onReplace, parsedFunction, visualize]
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

function VisualizeLabel({index, onClick, visualize}: VisualizeLabelProps) {
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
