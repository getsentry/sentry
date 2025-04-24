import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';

import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarVisualizeProps {
  equationSupport?: boolean;
}

export function ToolbarVisualize({equationSupport}: ToolbarVisualizeProps) {
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();

  const addChart = useCallback(() => {
    const newVisualizes = [...visualizes, new Visualize([DEFAULT_VISUALIZATION])].map(
      visualize => visualize.toJSON()
    );
    setVisualizes(newVisualizes, [DEFAULT_VISUALIZATION_FIELD]);
  }, [setVisualizes, visualizes]);

  const addOverlay = useCallback(
    (group: number) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          visualize = visualize.replace({
            yAxes: [...visualize.yAxes, DEFAULT_VISUALIZATION],
          });
        }
        return visualize.toJSON();
      });
      setVisualizes(newVisualizes, [DEFAULT_VISUALIZATION_FIELD]);
    },
    [setVisualizes, visualizes]
  );

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
    <StyledToolbarSection data-test-id="section-visualizes">
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
        {visualizes.map((visualize, group) => {
          return (
            <Fragment key={group}>
              {visualize.yAxes.map((yAxis, index) => (
                <Fragment key={index}>
                  {equationSupport ? (
                    <VisualizeEquation
                      canDelete={canDelete}
                      deleteOverlay={deleteOverlay}
                      group={group}
                      index={index}
                      label={shouldRenderLabel ? visualize.label : undefined}
                      yAxis={visualizes[group]?.yAxes?.[index]}
                      visualizes={visualizes}
                      setVisualizes={setVisualizes}
                    />
                  ) : (
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
                  )}
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
    </StyledToolbarSection>
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
  const yAxes: string[] = useMemo(() => {
    return visualizes.flatMap(visualize => visualize.yAxes);
  }, [visualizes]);

  const parsedVisualize = useMemo(() => parseFunction(yAxis)!, [yAxis]);

  // We want to lock down the fields dropdown when using count so that we can
  // render `count(spans)` for better legibility. However, for backwards
  // compatibility, we don't want to lock down all `count` queries immediately.
  const lockOptions = yAxis === DEFAULT_VISUALIZATION;

  const countFieldOptions: Array<SelectOption<string>> = useMemo(
    () => [
      {
        label: t('spans'),
        value: DEFAULT_VISUALIZATION_FIELD,
        textValue: DEFAULT_VISUALIZATION_FIELD,
      },
    ],
    []
  );
  const defaultFieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    yAxes,
    yAxis,
  });
  const fieldOptions = lockOptions ? countFieldOptions : defaultFieldOptions;

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  const setChartField = useCallback(
    ({value}: SelectOption<SelectKey>) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          const newYAxes = [...visualize.yAxes];
          newYAxes[index] = `${parsedVisualize.name}(${value})`;
          visualize = visualize.replace({yAxes: newYAxes});
        }
        return visualize.toJSON();
      });
      setVisualizes(newVisualizes, [String(value)]);
    },
    [group, index, parsedVisualize, setVisualizes, visualizes]
  );

  const setChartAggregate = useCallback(
    ({value}: SelectOption<SelectKey>) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          const newYAxes = [...visualize.yAxes];
          newYAxes[index] = updateVisualizeAggregate({
            newAggregate: value as string,
            oldAggregate: parsedVisualize.name,
            oldArgument: parsedVisualize.arguments[0]!,
          });
          visualize = visualize.replace({yAxes: newYAxes});
        }
        return visualize.toJSON();
      });
      setVisualizes(newVisualizes);
    },
    [group, index, parsedVisualize, setVisualizes, visualizes]
  );

  return (
    <ToolbarRow>
      {label && <ChartLabel>{label}</ChartLabel>}
      <AggregateCompactSelect
        options={aggregateOptions}
        value={parsedVisualize.name}
        onChange={setChartAggregate}
      />
      <ColumnCompactSelect
        searchable
        options={fieldOptions}
        value={parsedVisualize.arguments[0]}
        onChange={setChartField}
        disabled={lockOptions}
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

interface VisualizeEquationProps {
  canDelete: boolean;
  deleteOverlay: (group: number, index: number) => void;
  group: number;
  index: number;
  setVisualizes: (visualizes: BaseVisualize[], fields?: string[]) => void;
  visualizes: Visualize[];
  label?: string;
  yAxis?: string;
}

function VisualizeEquation({
  canDelete,
  deleteOverlay,
  group,
  index,
  setVisualizes,
  label,
  yAxis,
  visualizes,
}: VisualizeEquationProps) {
  const setChartYAxis = useCallback(
    (expression: Expression) => {
      if (expression.isValid) {
        const functions = expression.tokens.filter(isTokenFunction);
        const newVisualizes = visualizes.map((visualize, i) => {
          if (i === group) {
            const yAxes = [...visualize.yAxes];
            yAxes[index] = expression.text;
            visualize = visualize.replace({yAxes});
          }
          return visualize.toJSON();
        });
        setVisualizes(
          newVisualizes,
          functions.flatMap(func => func.attributes.map(attr => attr.format()))
        );
      }
    },
    [group, index, setVisualizes, visualizes]
  );

  const aggregateFunctions = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        name: aggregate,
        label: `${aggregate}(\u2026)`,
      };
    });
  }, []);

  const yAxes: string[] = useMemo(() => {
    return visualizes.flatMap(visualize => visualize.yAxes);
  }, [visualizes]);

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({yAxes, yAxis});

  const functionArguments = useMemo(() => {
    return fieldOptions.map(o => {
      return {
        name: o.value,
        label: o.label,
      };
    });
  }, [fieldOptions]);

  return (
    <ToolbarRow>
      {label && <ChartLabel>{label}</ChartLabel>}
      <ArithmeticBuilder
        expression={yAxis || ''}
        setExpression={setChartYAxis}
        aggregateFunctions={aggregateFunctions}
        functionArguments={functionArguments}
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

const StyledToolbarSection = styled(ToolbarSection)`
  margin-bottom: ${space(1)};
`;
