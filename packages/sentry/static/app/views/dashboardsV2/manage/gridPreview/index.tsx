import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import GridLayout, {WidthProvider} from 'react-grid-layout';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';
import {
  assignDefaultLayout,
  calculateColumnDepths,
} from 'sentry/views/dashboardsV2/layoutUtils';
import {DisplayType, WidgetLayout, WidgetPreview} from 'sentry/views/dashboardsV2/types';

import WidgetArea from './chartPreviews/area';
import WidgetBar from './chartPreviews/bar';
import WidgetLine from './chartPreviews/line';
import WidgetBigNumber from './chartPreviews/number';
import WidgetTable from './chartPreviews/table';
import WidgetWorldMap from './chartPreviews/world';

function miniWidget(displayType: DisplayType): () => JSX.Element {
  switch (displayType) {
    case DisplayType.BAR:
      return WidgetBar;
    case DisplayType.AREA:
    case DisplayType.TOP_N:
      return WidgetArea;
    case DisplayType.BIG_NUMBER:
      return WidgetBigNumber;
    case DisplayType.TABLE:
      return WidgetTable;
    case DisplayType.WORLD_MAP:
      return WidgetWorldMap;
    case DisplayType.LINE:
    default:
      return WidgetLine;
  }
}

type Props = {
  widgetPreview: WidgetPreview[];
};

function GridPreview({widgetPreview}: Props) {
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
      {renderPreview.map(({displayType, layout}) => {
        const Preview = miniWidget(displayType);
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

export default GridPreview;

const PreviewWrapper = styled('div')`
  padding: 20px 8px 4px 12px;
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

// ::before is the widget title and ::after is the border
const Chart = styled('div')`
  background: white;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 12px;
    top: 10px;
    width: max(30px, 30%);
    height: 4px;
    background-color: #d4d1ec;
    border-radius: 8px;
  }

  &::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    width: 100%;
    height: 100%;
    border: 2px solid #444674;
  }
`;

const StyledGridLayout = styled(WidthProvider(GridLayout))`
  margin: -4px;
`;
