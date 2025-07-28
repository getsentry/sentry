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
import {updateVisualizeAggregate} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface VisualizeDropdownProps {
  canDelete: boolean;
  onDelete: () => void;
  onReplace: (yAxis: string) => void;
  traceItemType: TraceItemDataset;
  yAxis: string;
}

export function VisualizeDropdown({
  canDelete,
  onDelete,
  onReplace,
  yAxis,
  traceItemType,
}: VisualizeDropdownProps) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');

  const aggregateOptions: Array<SelectOption<string>> = useMemo(
    () => getVisualizeAggregates(traceItemType),
    [traceItemType]
  );

  const parsedFunction = useMemo(() => parseFunction(yAxis), [yAxis]);

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
    parsedFunction,
    traceItemType,
  });

  const setYAxis = useCallback(
    (newYAxis: string) => {
      onReplace(newYAxis);
    },
    [onReplace]
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
      <FieldCompactSelect
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

function getVisualizeAggregates(traceItemType: TraceItemDataset) {
  switch (traceItemType) {
    case TraceItemDataset.SPANS:
      return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
        return {
          label: aggregate,
          value: aggregate,
          textValue: aggregate,
        };
      });
    default:
      throw new Error('Cannot determine aggregate options for unknown trace item type');
  }
}

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;

  > button {
    width: 100%;
  }
`;

const FieldCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;

  > button {
    width: 100%;
  }
`;
