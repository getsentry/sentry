import {Fragment, useCallback, useMemo} from 'react';
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
  DEFAULT_VISUALIZATION_FIELD,
  MAX_VISUALIZES,
  updateVisualizeAggregate,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
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
    const newVisualizes = [...visualizes, new Visualize([DEFAULT_VISUALIZATION])].map(
      visualize => visualize.toJSON()
    );
    setVisualizes(newVisualizes, [DEFAULT_VISUALIZATION_FIELD]);
  }, [setVisualizes, visualizes]);

  const deleteOverlay = useCallback(
    (group: number, index: number) => {
      const newVisualizes = visualizes
        .map((visualize, orgGroup) => {
          if (group === orgGroup) {
            visualize = visualize.replace({
              yAxes: visualize.yAxes.filter((_, orgIndex) => index !== orgIndex),
            });
          }
          return visualize.toJSON();
        })
        .filter(visualize => visualize.yAxes.length > 0);
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const canDelete =
    visualizes.map(visualize => visualize.yAxes.length).reduce((a, b) => a + b, 0) > 1;

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
          <Fragment key={group}>
            {visualize.yAxes.map((yAxis, index) => (
              <Fragment key={index}>
                <VisualizeDropdown
                  canDelete={canDelete}
                  deleteOverlay={deleteOverlay}
                  group={group}
                  index={index}
                  label={shouldRenderLabel ? visualize.label : undefined}
                  yAxis={yAxis}
                  visualizes={visualizes}
                  setVisualizes={setVisualizes}
                />
              </Fragment>
            ))}
          </Fragment>
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
  deleteOverlay: (group: number, index: number) => void;
  group: number;
  index: number;
  setVisualizes: (visualizes: BaseVisualize[], fields?: string[]) => void;
  visualizes: Visualize[];
  yAxis: string;
  label?: string;
}

function VisualizeDropdown({
  canDelete,
  deleteOverlay,
  group,
  index,
  setVisualizes,
  visualizes,
  yAxis,
  label,
}: VisualizeDropdownProps) {
  const {tags: stringTags} = useSpanTags('string');
  const {tags: numberTags} = useSpanTags('number');

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
    (newYAxis: string, fields?: string[]) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          const newYAxes = [...visualize.yAxes];
          newYAxes[index] = newYAxis;
          visualize = visualize.replace({yAxes: newYAxes});
        }
        return visualize.toJSON();
      });
      setVisualizes(newVisualizes, fields);
    },
    [group, index, setVisualizes, visualizes]
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
      setYAxis(`${parsedFunction?.name}(${option.value})`, [option.value as string]);
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
          onClick={() => deleteOverlay(group, index)}
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
