import type {MouseEventHandler, ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';

import {IconHide} from 'sentry/icons/iconHide';
import {EQUATION_PREFIX, parseFunction} from 'sentry/utils/discover/fields';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';
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
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  isVisualizeEquation,
  isVisualizeFunction,
  MAX_VISUALIZES,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {SPAN_AGGREGATE_OPTIONS} from 'sentry/views/explore/toolbar/constants';
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
          <ToolbarVisualizeItem
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

function ToolbarVisualizeItem({
  canDelete,
  label,
  onDelete,
  onReplace,
  visualize,
}: VisualizeDropdownProps) {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 200);
  return (
    <TraceItemAttributeProvider
      enabled
      traceItemType={TraceItemDataset.SPANS}
      search={debouncedSearch}
    >
      <VisualizeDropdown
        canDelete={canDelete}
        onDelete={onDelete}
        onReplace={onReplace}
        visualize={visualize}
        label={label}
        onSearch={setSearch}
        onClose={() => setSearch(undefined)}
      />
    </TraceItemAttributeProvider>
  );
}

function VisualizeDropdown({
  canDelete,
  onDelete,
  onReplace,
  visualize,
  label,
  onSearch,
  onClose,
}: VisualizeDropdownProps & {onClose: () => void; onSearch: (search: string) => void}) {
  const organization = useOrganization();
  const {tags: stringTags, isLoading: stringTagsLoading} = useTraceItemTags('string');
  const {tags: numberTags, isLoading: numberTagsLoading} = useTraceItemTags('number');
  const {tags: booleanTags, isLoading: booleanTagsLoading} = useTraceItemTags('boolean');
  const hasMultiSelect = organization.features.includes('traces-overlay-charts-ui');

  const parsedFunctions = useMemo(
    () => visualize.yAxes.map(yAxis => parseFunction(yAxis)),
    [visualize.yAxes]
  );
  const parsedFunction = parsedFunctions[0] ?? null;
  const parsedAggregates = useMemo(
    () => parsedFunctions.flatMap(func => (func?.name ? [func.name] : [])),
    [parsedFunctions]
  );

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey> | Array<SelectOption<SelectKey>>) => {
      if (Array.isArray(option)) {
        let selectedAggregates = option.flatMap(selected => {
          return typeof selected.value === 'string' ? [selected.value] : [];
        });

        const previousAggregates = new Set(parsedAggregates);
        const newlyAdded = selectedAggregates.find(
          aggregate => !previousAggregates.has(aggregate)
        );
        if (newlyAdded) {
          const targetGroup = SPAN_AGGREGATE_OPTIONS.find(section =>
            section.options.some(opt => opt.value === newlyAdded)
          );
          if (targetGroup) {
            const groupValues = new Set(
              targetGroup.options.flatMap(opt =>
                typeof opt.value === 'string' ? [opt.value] : []
              )
            );
            selectedAggregates = selectedAggregates.filter(aggregate =>
              groupValues.has(aggregate)
            );
          }
        }

        if (selectedAggregates.length === 0) {
          onReplace(visualize.replace({yAxis: DEFAULT_VISUALIZATION}));
          return;
        }

        const yAxes = selectedAggregates.map(aggregate =>
          updateVisualizeAggregate({
            newAggregate: aggregate,
            oldAggregate: parsedFunction?.name,
            oldArguments: parsedFunction?.arguments,
          })
        );
        onReplace(visualize.replace({yAxes}));
        return;
      }

      if (typeof option.value === 'string') {
        const yAxis = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: parsedFunction?.name,
          oldArguments: parsedFunction?.arguments,
        });
        onReplace(visualize.replace({yAxis}));
      }
    },
    [
      onReplace,
      parsedAggregates,
      parsedFunction?.arguments,
      parsedFunction?.name,
      visualize,
    ]
  );

  const getFieldValueType = useCallback(
    (field: string): FieldValueType => {
      const tag = numberTags[field] ?? stringTags[field] ?? booleanTags[field];
      const fieldDefinition = tag
        ? getFieldDefinition(field, 'span', tag.kind)
        : getFieldDefinition(field, 'span');

      if (fieldDefinition?.valueType) {
        return fieldDefinition.valueType;
      }

      if (Object.hasOwn(numberTags, field)) {
        return FieldValueType.NUMBER;
      }
      if (Object.hasOwn(booleanTags, field)) {
        return FieldValueType.BOOLEAN;
      }
      return FieldValueType.STRING;
    },
    [booleanTags, numberTags, stringTags]
  );

  const canApplyArgumentToAggregate = useCallback(
    (aggregate: string, index: number, nextArgument: string): boolean => {
      const aggregateDefinition = getFieldDefinition(aggregate, 'span');
      const parameter = aggregateDefinition?.parameters?.[index];

      if (!parameter || parameter.kind !== 'column') {
        return false;
      }

      const valueType = getFieldValueType(nextArgument);
      if (typeof parameter.columnTypes === 'function') {
        return parameter.columnTypes({
          key: nextArgument,
          valueType,
        });
      }

      return parameter.columnTypes.includes(valueType);
    },
    [getFieldValueType]
  );

  const onChangeArgument = useCallback(
    (index: number, option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const nextArgument = option.value;
        if (hasMultiSelect && visualize.yAxes.length > 1) {
          const yAxes = parsedFunctions.flatMap(func => {
            if (!func) {
              return [];
            }

            if (!canApplyArgumentToAggregate(func.name, index, nextArgument)) {
              return [
                updateVisualizeAggregate({
                  newAggregate: func.name,
                  oldAggregate: func.name,
                  oldArguments: func.arguments,
                }),
              ];
            }

            let args = cloneDeep(func.arguments);
            if (args) {
              args[index] = nextArgument;
            } else {
              args = [nextArgument];
            }
            return [`${func.name}(${args.join(',')})`];
          });
          onReplace(visualize.replace({yAxes}));
          return;
        }

        let args = cloneDeep(parsedFunction?.arguments);
        if (args) {
          args[index] = nextArgument;
        } else {
          args = [nextArgument];
        }
        const yAxis = `${parsedFunction?.name}(${args.join(',')})`;
        onReplace(visualize.replace({yAxis}));
      }
    },
    [
      canApplyArgumentToAggregate,
      hasMultiSelect,
      onReplace,
      parsedFunction,
      parsedFunctions,
      visualize,
    ]
  );

  const aggregateValue = hasMultiSelect ? parsedAggregates : (parsedFunction?.name ?? '');

  return (
    <ToolbarVisualizeDropdown
      aggregateMultiple={hasMultiSelect}
      aggregateOptions={SPAN_AGGREGATE_OPTIONS}
      aggregateValue={aggregateValue}
      fieldOptions={fieldOptions}
      canDelete={canDelete}
      onChangeAggregate={onChangeAggregate}
      onChangeArgument={onChangeArgument}
      onDelete={onDelete}
      parsedFunction={parsedFunction}
      label={label}
      loading={numberTagsLoading || stringTagsLoading || booleanTagsLoading}
      onSearch={onSearch}
      onClose={onClose}
    />
  );
}

interface VisualizeLabelProps {
  index: number;
  onClick: MouseEventHandler<HTMLDivElement>;
  visualize: Visualize;
}

export function getVisualizeLabel(index: number) {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function VisualizeLabel({index, onClick, visualize}: VisualizeLabelProps) {
  const label = visualize.visible ? getVisualizeLabel(index) : <IconHide />;

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
