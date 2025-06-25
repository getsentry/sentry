import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {
  useExploreVisualizes,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  MAX_VISUALIZES,
  updateVisualizeAggregate,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';

import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

export function ToolbarVisualize() {
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();

  const addChart = useCallback(() => {
    const newVisualizes = [...visualizes, new Visualize(DEFAULT_VISUALIZATION)].map(
      visualize => visualize.toJSON()
    );
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const deleteOverlay = useCallback(
    (group: number) => {
      const newVisualizes = visualizes
        .toSpliced(group, 1)
        .map(visualize => visualize.toJSON());
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const canDelete = visualizes.length > 1;

  const shouldRenderLabel = visualizes.length > 1;

  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarHeader>
        <Tooltip
          position="right"
          title={t(
            'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
          )}
        >
          <ToolbarLabel>{t('Visualize')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      {visualizes.map((visualize, group) => {
        return (
          <VisualizeDropdown
            key={group}
            canDelete={canDelete}
            deleteOverlay={deleteOverlay}
            group={group}
            label={shouldRenderLabel ? visualize.label : undefined}
            yAxis={visualize.yAxis}
            visualizes={visualizes}
            setVisualizes={setVisualizes}
          />
        );
      })}
      <ToolbarFooter>
        <ToolbarFooterButton
          borderless
          size="zero"
          icon={<IconAdd />}
          onClick={addChart}
          priority="link"
          aria-label={t('Add Chart')}
          disabled={visualizes.length >= MAX_VISUALIZES}
        >
          {t('Add Chart')}
        </ToolbarFooterButton>
      </ToolbarFooter>
    </ToolbarSection>
  );
}

interface VisualizeDropdownProps {
  canDelete: boolean;
  deleteOverlay: (group: number) => void;
  group: number;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  visualizes: Visualize[];
  yAxis: string;
  label?: string;
}

function VisualizeDropdown({
  canDelete,
  deleteOverlay,
  group,
  setVisualizes,
  visualizes,
  yAxis,
  label,
}: VisualizeDropdownProps) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');

  const parsedFunction = useMemo(() => parseFunction(yAxis), [yAxis]);

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
  });

  const setYAxis = useCallback(
    (newYAxis: string) => {
      const newVisualizes = visualizes
        .toSpliced(group, 1, visualizes[group]!.replace({yAxis: newYAxis}))
        .map(visualize => visualize.toJSON());
      setVisualizes(newVisualizes);
    },
    [group, setVisualizes, visualizes]
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
      {label && <ChartLabel>{label}</ChartLabel>}
      <AggregateCompactSelect
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
          onClick={() => deleteOverlay(group)}
          aria-label={t('Remove Overlay')}
        />
      ) : null}
    </ToolbarRow>
  );
}

const ChartLabel = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  width: 38px;
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
  align-content: center;
  align-self: stretch;
`;

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;

  > button {
    width: 100%;
  }
`;
