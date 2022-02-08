import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import GridLayout, {WidthProvider} from 'react-grid-layout';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';
import {
  DEFAULT_WIDGET_WIDTH,
  getDefaultWidgetHeight,
  getInitialColumnDepths,
  getNextAvailablePosition,
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
  // TODO(nar): Clean this up, it should be reusable with how it's handled on the dashboard
  let columnDepths = getInitialColumnDepths();
  widgetPreview
    .filter(({layout}) => defined(layout))
    .forEach(({layout}) => {
      const {x, y, w, h} = layout as WidgetLayout; // nulls were filtered out
      // Adjust the column depths for each column the widget takes up
      for (let col = x; col < x + w; col++) {
        columnDepths[col] = Math.max(y + h, columnDepths[col]);
      }
    });
  const renderPreview = widgetPreview.map(item => {
    if (defined(item.layout)) {
      return item;
    }

    const height = getDefaultWidgetHeight(item.displayType);
    const [nextPosition, nextColumnDepths] = getNextAvailablePosition(
      columnDepths,
      height
    );
    columnDepths = nextColumnDepths;

    return {
      ...item,
      layout: {...nextPosition, h: height, minH: height, w: DEFAULT_WIDGET_WIDTH},
    };
  });

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
