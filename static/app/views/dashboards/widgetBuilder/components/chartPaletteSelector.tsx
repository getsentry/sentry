import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {CHART_PALETTE_OPTIONS} from 'sentry/views/dashboards/utils/chartPalettes';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

const SWATCH_COUNT = 5;

export function ChartPaletteSelector() {
  const {state, dispatch} = useWidgetBuilderContext();
  const theme = useTheme();
  const defaultColors = theme.chart.getColorPalette(SWATCH_COUNT - 1);

  return (
    <Flex align="center" gap="sm">
      <Text>{t('Color Palette')}</Text>
      <CompactSelect
        value={state.chartPalette ?? 'default'}
        onChange={option => {
          dispatch({
            type: BuilderStateAction.SET_CHART_PALETTE,
            payload: option.value,
          });
        }}
        options={CHART_PALETTE_OPTIONS.map(option => ({
          value: option.id,
          label: option.label,
          trailingItems: (
            <SwatchRow>
              {(option.id === 'default' ? defaultColors : option.colors)
                .slice(0, SWATCH_COUNT)
                .map((color, i) => (
                  <Swatch key={i} style={{backgroundColor: color}} />
                ))}
            </SwatchRow>
          ),
        }))}
      />
    </Flex>
  );
}

const SwatchRow = styled('div')`
  display: flex;
  gap: 2px;
`;

const Swatch = styled('div')`
  width: 12px;
  height: 12px;
  border-radius: 2px;
`;
