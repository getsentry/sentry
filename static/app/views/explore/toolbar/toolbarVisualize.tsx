import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {IconHide} from 'sentry/icons/iconHide';
import {EQUATION_PREFIX, parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
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
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  MAX_VISUALIZES,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  isVisualizeEquation,
  isVisualizeFunction,
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

  const onDelete = useCallback(
    (group: number) => {
      const newVisualizes = visualizes
        .toSpliced(group, 1)
        .map(visualize => visualize.serialize());
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const canDelete = visualizes.filter(isVisualizeFunction).length > 1;

  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarVisualizeHeader />
      {visualizes.map((visualize, group) => {
        const label = (
          <VisualizeLabel
            index={group}
            visualize={visualize}
            onClick={() => toggleVisibility(group)}
          />
        );

        if (isVisualizeEquation(visualize)) {
          return (
            <VisualizeEquationInput
              key={group}
              onDelete={() => onDelete(group)}
              onReplace={newVisualize => replaceOverlay(group, newVisualize)}
              visualize={visualize}
              label={label}
            />
          );
        }

        return (
          <VisualizeDropdown
            key={group}
            canDelete={canDelete}
            onDelete={() => onDelete(group)}
            onReplace={newVisualize => replaceOverlay(group, newVisualize)}
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
  );
}

interface VisualizeDropdownProps {
  canDelete: boolean;
  label: ReactNode;
  onDelete: () => void;
  onReplace: (visualize: Visualize) => void;
  visualize: Visualize;
}

function VisualizeDropdown({
  canDelete,
  onDelete,
  onReplace,
  visualize,
  label,
}: VisualizeDropdownProps) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');

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

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
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
      aggregateOptions={aggregateOptions}
      fieldOptions={fieldOptions}
      canDelete={canDelete}
      onChangeAggregate={onChangeAggregate}
      onChangeArgument={onChangeArgument}
      onDelete={onDelete}
      parsedFunction={parsedFunction}
      label={label}
    />
  );
}

interface VisualizeLabelProps {
  index: number;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
}

function VisualizeLabel({index, onClick, visualize}: VisualizeLabelProps) {
  const label = visualize.visible ? (
    String.fromCharCode('A'.charCodeAt(0) + index)
  ) : (
    <IconHide />
  );

  return <Label onClick={onClick}>{label}</Label>;
}

const Label = styled('div')`
  cursor: pointer;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.purple100};
  color: ${p => p.theme.purple300};
  font-weight: ${p => p.theme.fontWeight.bold};
  width: 24px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
`;
