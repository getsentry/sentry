import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Responsive, WidthProvider} from 'react-grid-layout';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';

import {
  DEFAULT_WIDGET_WIDTH,
  getDefaultWidgetHeight,
  getInitialColumnDepths,
  getNextAvailablePosition,
} from '../layoutUtils';
import {DisplayType, Preview} from '../types';

import WidgetArea from './chartPreviews/area.svg';
import WidgetBar from './chartPreviews/bar.svg';
import WidgetLine from './chartPreviews/line.svg';
import WidgetBigNumber from './chartPreviews/number.svg';
import WidgetTable from './chartPreviews/table.svg';
import WidgetWorldMap from './chartPreviews/world.svg';

function WidgetGrid({preview}: {preview: Preview[]}) {
  function miniWidget(displayType: DisplayType): string {
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

  let columnDepths = getInitialColumnDepths();
  preview
    .filter(({layout}) => defined(layout))
    .forEach(({layout: {x, y, w, h}}) => {
      // Adjust the column depths for each column the widget takes up
      for (let col = x; col < x + w; col++) {
        columnDepths[col] = Math.max(y + h, columnDepths[col]);
      }
    });
  const renderPreview = preview.map(item => {
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
    // TODO: Should add margin: -10px here to re-align
    <GridLayout
      cols={{lg: 6}}
      rowHeight={40}
      isResizable={false}
      isDraggable={false}
      breakpoints={{lg: 1200}}
      useCSSTransforms={false}
      measureBeforeMount
    >
      {renderPreview.map(({displayType, layout}) => (
        <Chart key={uniqueId()} data-grid={{...layout}}>
          <WidgetImage src={miniWidget(displayType)} />
        </Chart>
      ))}
    </GridLayout>
  );
}

export default WidgetGrid;

const Chart = styled('div')`
  background: white;
  position: relative;

  // Label
  &::before {
    content: '';
    position: absolute;
    left: 12px;
    top: 10px;
    width: max(30px, 20%);
    height: 4px;
    background-color: #d4d1ec;
    border-radius: 8px;
  }

  // Border
  &::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    width: 100%;
    height: 100%;
    border: 2px solid #444674;
  }

  padding: 20px 8px 4px 12px;
`;

const WidgetImage = styled('img')`
  width: 100%;
  height: 100%;
`;

const GridLayout = styled(WidthProvider(Responsive))`
  margin: -10px;
`;
