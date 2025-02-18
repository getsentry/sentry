import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import {Button} from 'sentry/components/button';
import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {
  useExploreVisualizes,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  DEFAULT_VISUALIZATION_FIELD,
  MAX_VISUALIZES,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

type ParsedVisualize = {
  func: ParsedFunction;
  label: string;
};

interface ToolbarVisualizeProps {
  equationSupport?: boolean;
}

export function ToolbarVisualize({equationSupport}: ToolbarVisualizeProps) {
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();

  const parsedVisualizeGroups: ParsedVisualize[][] = useMemo(() => {
    return visualizes.map(visualize =>
      visualize.yAxes
        .map(parseFunction)
        .filter(defined)
        .map(func => {
          return {
            func,
            label: visualize.label,
          };
        })
    );
  }, [visualizes]);

  const yAxes: string[] = useMemo(() => {
    return visualizes.flatMap(visualize => visualize.yAxes);
  }, [visualizes]);

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({yAxes});

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  const addChart = useCallback(() => {
    setVisualizes(
      [...visualizes, {yAxes: [DEFAULT_VISUALIZATION], chartType: ChartType.LINE}],
      DEFAULT_VISUALIZATION_FIELD
    );
  }, [setVisualizes, visualizes]);

  const addOverlay = useCallback(
    (group: number) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group]!.yAxes.push(DEFAULT_VISUALIZATION);
      setVisualizes(newVisualizes, DEFAULT_VISUALIZATION_FIELD);
    },
    [setVisualizes, visualizes]
  );

  const setChartField = useCallback(
    (group: number, index: number, {value}: SelectOption<SelectKey>) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group]!.yAxes[index] =
        `${parsedVisualizeGroups[group]![index]!.func.name}(${value})`;
      setVisualizes(newVisualizes, String(value));
    },
    [parsedVisualizeGroups, setVisualizes, visualizes]
  );

  const setChartAggregate = useCallback(
    (group: number, index: number, {value}: SelectOption<SelectKey>) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group]!.yAxes[index] =
        `${value}(${parsedVisualizeGroups[group]![index]!.func.arguments[0]})`;
      setVisualizes(newVisualizes);
    },
    [parsedVisualizeGroups, setVisualizes, visualizes]
  );

  const setChartYAxis = useCallback(
    (group: number, index: number, yAxis: string) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group]!.yAxes[index] = yAxis;
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const deleteOverlay = useCallback(
    (group: number, index: number) => {
      const newVisualizes: Visualize[] = visualizes
        .map((visualize, orgGroup) => {
          if (group !== orgGroup) {
            return visualize;
          }

          return {
            ...visualize,
            yAxes: visualize.yAxes.filter((_, orgIndex) => index !== orgIndex),
          };
        })
        .filter(visualize => visualize.yAxes.length > 0);
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const canDelete =
    parsedVisualizeGroups
      .map(parsedVisualizeGroup => parsedVisualizeGroup.length)
      .reduce((a, b) => a + b, 0) > 1;

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
        <Tooltip title={t('Add a new chart')}>
          <ToolbarHeaderButton
            size="zero"
            icon={<IconAdd />}
            onClick={addChart}
            aria-label={t('Add Chart')}
            borderless
            disabled={visualizes.length >= MAX_VISUALIZES}
          />
        </Tooltip>
      </ToolbarHeader>
      <div>
        {parsedVisualizeGroups.map((parsedVisualizeGroup, group) => {
          return (
            <Fragment key={group}>
              {parsedVisualizeGroup.map((parsedVisualize, index) => (
                <Fragment key={index}>
                  <VisualizeDropdown
                    aggregateOptions={aggregateOptions}
                    fieldOptions={fieldOptions}
                    deleteOverlay={deleteOverlay}
                    group={group}
                    index={index}
                    canDelete={canDelete}
                    shouldRenderLabel={shouldRenderLabel}
                    parsedVisualize={parsedVisualize}
                    setChartAggregate={setChartAggregate}
                    setChartField={setChartField}
                  />
                  {equationSupport ? (
                    <VisualizeEquation
                      canDelete={canDelete}
                      deleteOverlay={deleteOverlay}
                      group={group}
                      index={index}
                      label={shouldRenderLabel ? parsedVisualize.label : undefined}
                      setChartYAxis={setChartYAxis}
                      yAxis={visualizes[group]?.yAxes?.[index]}
                    />
                  ) : null}
                </Fragment>
              ))}
              <ToolbarFooter>
                <ToolbarFooterButton
                  borderless
                  size="zero"
                  icon={<IconAdd />}
                  onClick={() => addOverlay(group)}
                  priority="link"
                  aria-label={t('Add Series')}
                >
                  {t('Add Series')}
                </ToolbarFooterButton>
              </ToolbarFooter>
            </Fragment>
          );
        })}
      </div>
    </ToolbarSection>
  );
}

interface VisualizeDropdownProps {
  aggregateOptions: Array<SelectOption<string>>;
  canDelete: boolean;
  deleteOverlay: (group: number, index: number) => void;
  fieldOptions: Array<SelectOption<string>>;
  group: number;
  index: number;
  parsedVisualize: ParsedVisualize;
  setChartAggregate: (
    group: number,
    index: number,
    {value}: SelectOption<SelectKey>
  ) => void;
  setChartField: (group: number, index: number, {value}: SelectOption<SelectKey>) => void;
  shouldRenderLabel: boolean;
}

function VisualizeDropdown({
  aggregateOptions,
  canDelete,
  deleteOverlay,
  fieldOptions,
  group,
  index,
  parsedVisualize,
  setChartAggregate,
  setChartField,
  shouldRenderLabel,
}: VisualizeDropdownProps) {
  return (
    <ToolbarRow>
      {shouldRenderLabel && <ChartLabel>{parsedVisualize.label}</ChartLabel>}
      <AggregateCompactSelect
        options={aggregateOptions}
        value={parsedVisualize.func.name}
        onChange={newAggregate => setChartAggregate(group, index, newAggregate)}
      />
      <ColumnCompactSelect
        searchable
        options={fieldOptions}
        value={parsedVisualize.func.arguments[0]}
        onChange={newField => setChartField(group, index, newField)}
      />
      <Button
        borderless
        icon={<IconDelete />}
        size="zero"
        disabled={!canDelete}
        onClick={() => deleteOverlay(group, index)}
        aria-label={t('Remove Overlay')}
      />
    </ToolbarRow>
  );
}

interface VisualizeEquationProps {
  canDelete: boolean;
  deleteOverlay: (group: number, index: number) => void;
  group: number;
  index: number;
  setChartYAxis: (group: number, index: number, yAxis: string) => void;
  label?: string;
  yAxis?: string;
}

function VisualizeEquation({
  canDelete,
  deleteOverlay,
  group,
  index,
  setChartYAxis,
  label,
  yAxis,
}: VisualizeEquationProps) {
  const setExpression = useCallback(
    (expression: string) => setChartYAxis(group, index, expression),
    [group, index, setChartYAxis]
  );

  return (
    <ToolbarRow>
      {label && <ChartLabel>{label}</ChartLabel>}
      <ArithmeticBuilder expression={yAxis || ''} setExpression={setExpression} />
      <Button
        borderless
        icon={<IconDelete />}
        size="zero"
        disabled={!canDelete}
        onClick={() => deleteOverlay(group, index)}
        aria-label={t('Remove Overlay')}
      />
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
