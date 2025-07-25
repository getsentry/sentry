import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {ToolbarRow} from 'sentry/views/explore/components/toolbar/styles';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  updateVisualizeAggregate,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface VisualizeDropdownProps {
  canDelete: boolean;
  onDelete: () => void;
  onReplace: (visualize: BaseVisualize) => void;
  traceItemType: TraceItemDataset;
  visualize: Visualize;
}

export function VisualizeDropdown({
  canDelete,
  onDelete,
  onReplace,
  visualize,
  traceItemType,
}: VisualizeDropdownProps) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');

  const parsedFunction = useMemo(() => parseFunction(visualize.yAxis), [visualize.yAxis]);

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
    parsedFunction,
    traceItemType,
  });

  const setYAxis = useCallback(
    (newYAxis: string) => {
      const newVisualize = visualize.replace({yAxis: newYAxis});
      onReplace(newVisualize.toJSON());
    },
    [onReplace, visualize]
  );

  const setChartAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      const newYAxis = updateVisualizeAggregate({
        newAggregate: option.value as string,
        oldAggregate: parsedFunction?.name,
        oldArgument: parsedFunction?.arguments[0]!,
      });
      setYAxis(newYAxis);
    },
    [parsedFunction, setYAxis]
  );

  const setChartField = useCallback(
    (option: SelectOption<SelectKey>) => {
      setYAxis(`${parsedFunction?.name}(${option.value})`);
    },
    [parsedFunction?.name, setYAxis]
  );

  return (
    <ToolbarRow>
      <AggregateCompactSelect
        searchable
        options={aggregateOptions}
        value={parsedFunction?.name ?? ''}
        onChange={setChartAggregate}
      />
      <ColumnCompactSelect
        searchable
        options={fieldOptions}
        value={parsedFunction?.arguments[0] ?? ''}
        onChange={setChartField}
        disabled={fieldOptions.length === 1}
      />
      {canDelete ? (
        <Button
          borderless
          icon={<IconDelete />}
          size="zero"
          onClick={onDelete}
          aria-label={t('Remove Overlay')}
        />
      ) : null}
    </ToolbarRow>
  );
}

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;

  > button {
    width: 100%;
  }
`;

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;

  > button {
    width: 100%;
  }
`;
