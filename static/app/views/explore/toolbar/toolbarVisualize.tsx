import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {Visualize} from 'sentry/views/explore/hooks/useVisualizes';
import {
  DEFAULT_VISUALIZATION,
  useVisualizes,
} from 'sentry/views/explore/hooks/useVisualizes';
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

interface ToolbarVisualizeProps {}

export function ToolbarVisualize({}: ToolbarVisualizeProps) {
  const [visualizes, setVisualizes] = useVisualizes();

  const numberTags = useSpanTags('number');

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

  const fieldOptions: SelectOption<string>[] = useMemo(() => {
    const options = Object.values(numberTags).map(tag => {
      return {
        label: tag.name,
        value: tag.key,
        textValue: tag.name,
      };
    });

    options.sort((a, b) => {
      if (a.label < b.label) {
        return -1;
      }

      if (a.label > b.label) {
        return 1;
      }

      return 0;
    });

    return options;
  }, [numberTags]);

  const aggregateOptions: SelectOption<string>[] = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

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
        `${parsedVisualizeGroups[group][index].func.name}(${value})`;
      setVisualizes(newVisualizes);
    },
    [parsedVisualizeGroups, setVisualizes, visualizes]
  );

  const setChartAggregate = useCallback(
    (group: number, index: number, {value}: SelectOption<string>) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[group].yAxes[index] =
        `${value}(${parsedVisualizeGroups[group][index].func.arguments[0]})`;
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
        <Tooltip
          position="right"
          title={t(
            'Primary metric that appears in your chart, overlays and/or equations.'
          )}
        >
          <ToolbarLabel>{t('Visualize')}</ToolbarLabel>
        </Tooltip>
        <ToolbarHeaderButton
          size="zero"
          icon={<IconAdd />}
          onClick={addChart}
          aria-label={t('Add Chart')}
          borderless
        />
      </ToolbarHeader>
      <div>
        {parsedVisualizeGroups.map((parsedVisualizeGroup, group) => {
          return (
            <Fragment key={group}>
              {parsedVisualizeGroup.map((parsedVisualize, index) => (
                <ToolbarRow key={index}>
                  <ChartLabel>{parsedVisualize.label}</ChartLabel>
                  <CompactSelect
                    searchable
                    options={fieldOptions}
                    value={parsedVisualize.func.arguments[0]}
                    onChange={newField => setChartField(group, index, newField)}
                  />
                  <CompactSelect
                    options={aggregateOptions}
                    value={parsedVisualize.func.name}
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
                    aria-label={t('Remove Overlay')}
                  />
                </ToolbarRow>
              ))}
              <ToolbarFooter>
                <ToolbarFooterButton
                  borderless
                  size="zero"
                  icon={<IconAdd />}
                  onClick={() => addOverlay(group)}
                  priority="link"
                  aria-label={t('Add Data')}
                >
                  {t('Add Data')}
                </ToolbarFooterButton>
              </ToolbarFooter>
            </Fragment>
          );
        })}
      </div>
    </ToolbarSection>
  );
}

const ChartLabel = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  min-width: 32px;
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
  align-content: center;
`;
