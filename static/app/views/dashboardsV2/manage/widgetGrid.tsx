import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {GridLayout, Layout, Responsive, WidthProvider} from 'react-grid-layout';
import styled from '@emotion/styled';

import WidgetArea from 'sentry-images/dashboard/widget-area.svg';
import WidgetBar from 'sentry-images/dashboard/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboard/widget-big-number.svg';
import WidgetLine from 'sentry-images/dashboard/widget-line-1.svg';
import WidgetTable from 'sentry-images/dashboard/widget-table.svg';
import WidgetWorldMap from 'sentry-images/dashboard/widget-world-map.svg';

import {DisplayType} from '../types';

const ResponsiveGrid = WidthProvider(Responsive);

function WidgetGrid({layout}: {layout: Layout[]}) {
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

  return (
    // TODO: Should add margin: -10px here to re-align
    <ResponsiveGrid
      cols={{lg: 6}}
      rowHeight={20}
      isResizable={false}
      isDraggable={false}
      breakpoints={{lg: 1200}}
      useCSSTransforms={false}
      measureBeforeMount
    >
      {layout.map(({i, displayType, ...rest}) => (
        <div style={{border: '1px solid black'}} key={i} data-grid={{...rest}}>
          <WidgetImage src={miniWidget(displayType)} />
        </div>
      ))}
    </ResponsiveGrid>
  );
}

export default WidgetGrid;

const WidgetImage = styled('img')`
  width: 100%;
  height: 100%;
`;
