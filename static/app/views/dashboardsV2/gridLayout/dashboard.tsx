import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import React from 'react';
import RGL, {WidthProvider} from 'react-grid-layout';

import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from '../addWidget';
import {Dashboard as DnDKitDashboard} from '../dashboard';
import {DisplayType, MAX_WIDGETS, Widget} from '../types';

import SortableWidget from './sortableWidget';

const NUM_COLS = 6;
const ROW_HEIGHT = 120;
const WIDGET_MARGINS = [16, 16];
const ADD_BUTTON_POSITION = {
  x: 0,
  y: Number.MAX_VALUE,
  w: 2,
  h: 1,
  isResizable: false,
};
const DEFAULT_WIDGET_WIDTH = 2;

const GridLayout = WidthProvider(RGL);

class Dashboard extends DnDKitDashboard {
  renderWidget(widget: Widget, index: number) {
    const {isEditing} = this.props;

    const key = generateWidgetId(widget, index);
    const dragId = key;

    const layout = {
      x: (DEFAULT_WIDGET_WIDTH * index) % NUM_COLS,
      y: Number.MAX_VALUE,
      w: DEFAULT_WIDGET_WIDTH,
      h: widget.displayType === DisplayType.BIG_NUMBER ? 1 : 2,
      minH: widget.displayType === DisplayType.BIG_NUMBER ? 1 : 2,
    };

    return (
      <div key={key} data-grid={layout}>
        <SortableWidget
          widget={widget}
          dragId={dragId}
          isEditing={isEditing}
          onDelete={this.handleDeleteWidget(index)}
          onEdit={this.handleEditWidget(widget, index)}
        />
      </div>
    );
  }

  render() {
    const {
      isEditing,
      dashboard: {widgets},
      organization,
    } = this.props;

    return (
      <GridLayout
        cols={NUM_COLS}
        rowHeight={ROW_HEIGHT}
        margin={WIDGET_MARGINS}
        draggableHandle="#grid-layout-drag-handle"
        isDraggable={isEditing}
        isResizable={isEditing}
        isBounded
      >
        {widgets.map((widget, index) => this.renderWidget(widget, index))}
        {isEditing && widgets.length < MAX_WIDGETS && (
          <div key={ADD_WIDGET_BUTTON_DRAG_ID} data-grid={ADD_BUTTON_POSITION}>
            <AddWidget
              orgFeatures={organization.features}
              onAddWidget={this.handleStartAdd}
              onOpenWidgetBuilder={this.handleOpenWidgetBuilder}
            />
          </div>
        )}
      </GridLayout>
    );
  }
}

export default withApi(withGlobalSelection(Dashboard));

function generateWidgetId(widget: Widget, index: number) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
}
