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

import {AreaPreview as WidgetArea} from './chartPreviews/area';
import {BarPreview as WidgetBar} from './chartPreviews/bar';
import {LinePreview as WidgetLine} from './chartPreviews/line';
import {NumberPreview as WidgetBigNumber} from './chartPreviews/number';
import {TablePreview as WidgetTable} from './chartPreviews/table';

function miniWidget(
  displayType: DisplayType,
  chartColor: string
): () => React.JSX.Element {
  switch (displayType) {
    case DisplayType.BAR:
      return function () {
        return <WidgetBar color={chartColor} />;
      };
    case DisplayType.AREA:
    case DisplayType.TOP_N:
      return function () {
        return <WidgetArea color={chartColor} />;
      };
    case DisplayType.BIG_NUMBER:
      return function () {
        return <WidgetBigNumber color={chartColor} />;
      };
    case DisplayType.TABLE:
      return WidgetTable;
    case DisplayType.LINE:
    default:
      return function () {
        return <WidgetLine color={chartColor} />;
      };
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
        const Preview = miniWidget(displayType, color);
        return (
          <Chart key={uniqueId()} data-grid={{...layout}}>
            <PreviewWrapper>
              <Preview />
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
    border-radius: 8px;
  }
`;

const StyledGridLayout = styled(WidthProvider(GridLayout))`
  margin: -4px;
`;
