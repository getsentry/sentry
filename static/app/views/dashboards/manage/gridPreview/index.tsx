import 'react-grid-layout/css/styles.css';

import GridLayout, {WidthProvider} from 'react-grid-layout';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';
import {
  assignDefaultLayout,
  calculateColumnDepths,
} from 'sentry/views/dashboards/layoutUtils';
import type {WidgetLayout, WidgetPreview} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

import {AreaPreview} from './chartPreviews/area';
import {BarPreview} from './chartPreviews/bar';
import {LinePreview} from './chartPreviews/line';
import {NumberPreview} from './chartPreviews/number';
import {TablePreview} from './chartPreviews/table';

function MiniWidget({displayType, color}: {color: string; displayType: DisplayType}) {
  switch (displayType) {
    case DisplayType.BAR:
      return <BarPreview color={color} />;
    case DisplayType.AREA:
    case DisplayType.TOP_N:
      return <AreaPreview color={color} />;
    case DisplayType.BIG_NUMBER:
      return <NumberPreview color={color} />;
    case DisplayType.TABLE:
      return <TablePreview />;
    case DisplayType.LINE:
    default:
      return <LinePreview color={color} />;
  }
}

type Props = {
  widgetPreview: WidgetPreview[];
};

export function GridPreview({widgetPreview}: Props) {
  const theme = useTheme();
  const chartPalette = theme.chart.getColorPalette(3);

  const definedLayouts = widgetPreview
    .map(({layout}) => layout)
    .filter((layout): layout is WidgetLayout => defined(layout));
  const columnDepths = calculateColumnDepths(definedLayouts);
  const renderPreview = assignDefaultLayout(widgetPreview, columnDepths);

  return (
    <StyledGridLayout
      cols={6}
      rowHeight={40}
      margin={[4, 4]}
      isResizable={false}
      isDraggable={false}
      useCSSTransforms={false}
      measureBeforeMount
    >
      {renderPreview.map(({displayType, layout}, index) => {
        const color = chartPalette[index % chartPalette.length]!;
        return (
          <Chart key={uniqueId()} data-grid={{...layout}}>
            <PreviewWrapper>
              <MiniWidget displayType={displayType} color={color} />
            </PreviewWrapper>
          </Chart>
        );
      })}
    </StyledGridLayout>
  );
}

const PreviewWrapper = styled('div')`
  padding: 20px 8px 4px 12px;
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

// ::before is the widget title placeholder
const Chart = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.sm};
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 12px;
    top: 10px;
    width: max(30px, 30%);
    height: 4px;
    background-color: ${p => p.theme.tokens.background.tertiary};
    border-radius: ${p => p.theme.radius.lg};
  }
`;

const StyledGridLayout = styled(WidthProvider(GridLayout))`
  margin: -4px;
`;
