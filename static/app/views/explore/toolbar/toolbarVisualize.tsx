import {Fragment, useCallback, useMemo} from 'react';

import {Button} from 'sentry/components/button';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
} from 'sentry/utils/fields';
import type {Visualize} from 'sentry/views/explore/hooks/useVisualizes';
import {
  DEFAULT_VISUALIZATION,
  useVisualizes,
} from 'sentry/views/explore/hooks/useVisualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SpanIndexedField} from 'sentry/views/insights/types';

import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarHeading,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarVisualizeProps {}

export function ToolbarVisualize({}: ToolbarVisualizeProps) {
  const [visualizes, setVisualizes] = useVisualizes();

  const parsedVisualizeGroups: ParsedFunction[][] = useMemo(() => {
    return visualizes.map(visualize =>
      visualize.yAxes.map(parseFunction).filter(defined)
    );
  }, [visualizes]);

  const fieldOptions: SelectOption<SpanIndexedField>[] =
    ALLOWED_EXPLORE_VISUALIZE_FIELDS.map(field => {
      return {
        label: field,
        value: field,
      };
    });

  const aggregateOptions: SelectOption<string>[] =
    ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
      };
    });

  const addChart = useCallback(() => {
    setVisualizes([
      ...visualizes,
      {yAxes: [DEFAULT_VISUALIZATION], chartType: ChartType.LINE},
    ]);
  }, [setVisualizes, visualizes]);

  const addOverlay = useCallback(
    (group: number) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group].yAxes.push(DEFAULT_VISUALIZATION);
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const setChartField = useCallback(
    (group: number, index: number, {value}: SelectOption<string>) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group].yAxes[index] =
        `${parsedVisualizeGroups[group][index].name}(${value})`;
      setVisualizes(newVisualizes);
    },
    [parsedVisualizeGroups, setVisualizes, visualizes]
  );

  const setChartAggregate = useCallback(
    (group: number, index: number, {value}: SelectOption<string>) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group].yAxes[index] =
        `${value}(${parsedVisualizeGroups[group][index].arguments[0]})`;
      setVisualizes(newVisualizes);
    },
    [parsedVisualizeGroups, setVisualizes, visualizes]
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

  const lastVisualization =
    parsedVisualizeGroups
      .map(parsedVisualizeGroup => parsedVisualizeGroup.length)
      .reduce((a, b) => a + b, 0) <= 1;

  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarHeader>
        <ToolbarHeading>{t('Visualize')}</ToolbarHeading>
        <ToolbarHeaderButton size="xs" onClick={addChart} borderless>
          {t('+Add Chart')}
        </ToolbarHeaderButton>
      </ToolbarHeader>
      <div>
        {parsedVisualizeGroups.map((parsedVisualizeGroup, group) => {
          return (
            <Fragment key={group}>
              {parsedVisualizeGroup.map((parsedVisualize, index) => (
                <ToolbarRow key={index}>
                  <CompactSelect
                    size="sm"
                    options={fieldOptions}
                    value={parsedVisualize.arguments[0]}
                    onChange={newField => setChartField(group, index, newField)}
                  />
                  <CompactSelect
                    size="sm"
                    options={aggregateOptions}
                    value={parsedVisualize?.name}
                    onChange={newAggregate =>
                      setChartAggregate(group, index, newAggregate)
                    }
                  />
                  <Button
                    borderless
                    icon={<IconDelete />}
                    size="zero"
                    disabled={lastVisualization}
                    onClick={() => deleteOverlay(group, index)}
                    aria-label={t('Remove')}
                  />
                </ToolbarRow>
              ))}
              <ToolbarFooter>
                <ToolbarFooterButton
                  size="xs"
                  onClick={() => addOverlay(group)}
                  borderless
                >
                  {t('+Add Overlay')}
                </ToolbarFooterButton>
              </ToolbarFooter>
            </Fragment>
          );
        })}
      </div>
    </ToolbarSection>
  );
}
