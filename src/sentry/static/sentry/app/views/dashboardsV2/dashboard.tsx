import React from 'react';
import ReactDOM from 'react-dom';
import LazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import {IconAdd} from 'app/icons';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import theme from 'app/utils/theme';
import {getPointerPosition} from 'app/utils/touch';
import {setBodyUserSelect, UserSelectValues} from 'app/utils/userselect';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {DashboardDetails, Widget} from './types';
import WidgetCard from './widgetCard';

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: GlobalSelection;
  isEditing: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
};

type State = {
  isDragging: boolean;
  draggingIndex: undefined | number;
  draggingTargetIndex: undefined | number;
  top: undefined | number;
  left: undefined | number;
  ghostLeftOffset: number;
  ghostTopOffset: number;
  widgets: undefined | Widget[];
};

class Dashboard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    // Create a DOM node that exists outside the DOM hierarchy of this component.
    // Widget ghosts will be rendered within this portal.
    const portal = document.createElement('div');

    portal.style.position = 'absolute';
    portal.style.top = '0';
    portal.style.left = '0';
    portal.style.zIndex = String(theme.zIndex.modal);

    this.portal = portal;
  }

  state: State = {
    draggingIndex: undefined,
    draggingTargetIndex: undefined,
    isDragging: false,
    top: undefined,
    left: undefined,
    ghostLeftOffset: 0,
    ghostTopOffset: 0,
    widgets: undefined,
  };

  componentDidMount() {
    const {isEditing} = this.props;
    // Load organization tags when in edit mode.
    if (isEditing) {
      this.fetchTags();
    }

    if (this.portal) {
      document.body.appendChild(this.portal);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {isEditing} = this.props;

    // Load organization tags when going into edit mode.
    // We use tags on the add widget modal.
    if (prevProps.isEditing !== isEditing && isEditing) {
      this.fetchTags();
    }
  }

  componentWillUnmount() {
    if (this.portal) {
      document.body.removeChild(this.portal);
    }
    this.cleanUpListeners();
  }

  previousUserSelect: UserSelectValues | null = null;
  portal: HTMLElement | null = null;
  dragGhostRef = React.createRef<HTMLDivElement>();

  fetchTags() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
  }

  handleStartAdd = () => {
    const {organization, dashboard, selection} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      selection,
      onAddWidget: this.handleAddComplete,
    });
  };

  handleAddComplete = (widget: Widget) => {
    this.props.onUpdate([...this.props.dashboard.widgets, widget]);
  };

  handleUpdateComplete = (index: number) => (nextWidget: Widget) => {
    const nextList = [...this.props.dashboard.widgets];
    nextList[index] = nextWidget;
    this.props.onUpdate(nextList);
  };

  handleDeleteWidget = (index: number) => () => {
    const nextList = [...this.props.dashboard.widgets];
    nextList.splice(index, 1);
    this.props.onUpdate(nextList);
  };

  handleEditWidget = (widget: Widget, index: number) => () => {
    const {organization, dashboard, selection} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      widget,
      selection,
      onAddWidget: this.handleAddComplete,
      onUpdateWidget: this.handleUpdateComplete(index),
    });
  };

  cleanUpListeners() {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onWidgetDragMove);
      window.removeEventListener('mouseup', this.onWidgetDragEnd);
    }
  }

  shallowCloneWidgets() {
    return this.props.dashboard.widgets.map(
      (widget, index): Widget => {
        return {
          ...widget,
          id: widget.id ?? String(index),
        };
      }
    );
  }

  startWidgetDrag = (index: number) => (
    event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>
  ) => {
    if (this.state.isDragging || !['mousedown', 'touchstart'].includes(event.type)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // prevent the user from selecting things when dragging a widget.
    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor can drag anywhere
    window.addEventListener('mousemove', this.onWidgetDragMove);
    window.addEventListener('mouseup', this.onWidgetDragEnd);

    // If the target element is removed from the document, events will still be targeted at it, and hence won't
    // necessarily bubble up to the window or document anymore.
    // If there is any risk of an element being removed while it is being touched, the best practice is to attach the
    // touch listeners directly to the target.
    //
    // Source: https://developer.mozilla.org/en-US/docs/Web/API/Touch/target
    //
    // React may remove event.target from the document, and thus window.addEventListener('touchmove') would not get
    // called. Hence, for touch events, we attach to event.target directly, and
    // persist the event.
    event.target.addEventListener('touchmove', this.onWidgetDragMove as any);
    event.persist();
    const onTouchEnd = () => {
      if (event.target) {
        event.target.removeEventListener('touchmove', this.onWidgetDragMove as any);
        event.target.removeEventListener('touchend', onTouchEnd);
      }
    };
    event.target.addEventListener('touchend', onTouchEnd);

    const widgetWrappers = document.querySelectorAll<HTMLDivElement>(
      '[data-component="widget-wrapper"]'
    );

    const widgetWrapper = widgetWrappers[index];
    const rects = widgetWrapper.getBoundingClientRect();
    let {ghostLeftOffset, ghostTopOffset} = this.state;

    if (this.dragGhostRef.current) {
      const ghostDOM = this.dragGhostRef.current;

      // create the ghost widget
      const newClone = widgetWrapper.cloneNode(true) as HTMLDivElement;
      newClone.removeAttribute('data-component');

      const iconContainer = widgetWrapper.querySelector<HTMLDivElement>(
        '[data-component="icon-container"]'
      );
      ghostLeftOffset = iconContainer ? iconContainer.offsetLeft : 0;
      ghostTopOffset = iconContainer ? iconContainer.offsetTop : 0;

      newClone.style.width = `${rects.width}px`;
      newClone.style.height = `${rects.height}px`;

      ghostDOM.appendChild(newClone);

      ghostDOM.style.left = `${getPointerPosition(event, 'pageX') - ghostLeftOffset}px`;
      ghostDOM.style.top = `${getPointerPosition(event, 'pageY') - ghostTopOffset}px`;
    }

    this.setState({
      isDragging: true,
      draggingIndex: index,
      draggingTargetIndex: index,
      top: getPointerPosition(event, 'pageY'),
      left: getPointerPosition(event, 'pageX'),
      widgets: this.shallowCloneWidgets(),
      ghostLeftOffset,
      ghostTopOffset,
    });
  };

  onWidgetDragMove = (event: MouseEvent | TouchEvent) => {
    if (
      !this.state.isDragging ||
      !['mousemove', 'touchmove'].includes(event.type) ||
      !this.state.widgets ||
      this.state.draggingIndex === undefined
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const {
      ghostLeftOffset,
      ghostTopOffset,
      draggingIndex,
      draggingTargetIndex,
    } = this.state;

    if (this.dragGhostRef.current) {
      // move the ghost box
      const ghostDOM = this.dragGhostRef.current;
      ghostDOM.style.left = `${getPointerPosition(event, 'pageX') - ghostLeftOffset}px`;
      ghostDOM.style.top = `${getPointerPosition(event, 'pageY') - ghostTopOffset}px`;
    }

    const widgetWrappers = document.querySelectorAll<HTMLDivElement>(
      '[data-component="widget-wrapper"]'
    );

    // Find the widget that the ghost is currently over.
    const targetIndex = Array.from(widgetWrappers).findIndex(widgetWrapper => {
      const rects = widgetWrapper.getBoundingClientRect();
      const top = getPointerPosition(event, 'clientY');
      const left = getPointerPosition(event, 'clientX');

      const topStart = rects.top;
      const topEnd = rects.top + rects.height;

      const leftStart = rects.left;
      const leftEnd = rects.left + rects.width;

      return topStart <= top && top <= topEnd && leftStart <= left && left <= leftEnd;
    });

    if (targetIndex >= 0 && targetIndex !== draggingTargetIndex) {
      const nextWidgets = this.shallowCloneWidgets();
      const removed = nextWidgets.splice(draggingIndex, 1);
      nextWidgets.splice(targetIndex, 0, removed[0]);

      this.setState({draggingTargetIndex: targetIndex, widgets: nextWidgets});
    }
  };

  onWidgetDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!this.state.isDragging || !['mouseup', 'touchend'].includes(event.type)) {
      return;
    }

    const sourceIndex = this.state.draggingIndex;
    const targetIndex = this.state.draggingTargetIndex;
    if (typeof sourceIndex !== 'number' || typeof targetIndex !== 'number') {
      return;
    }

    // remove listeners that were attached in startWidgetDrag
    this.cleanUpListeners();

    // restore body user-select values
    if (this.previousUserSelect) {
      setBodyUserSelect(this.previousUserSelect);
      this.previousUserSelect = null;
    }

    if (this.dragGhostRef.current) {
      const ghostDOM = this.dragGhostRef.current;
      ghostDOM.innerHTML = '';
    }

    // Reorder widgets and trigger change.
    if (sourceIndex !== targetIndex) {
      const newWidgets = [...this.props.dashboard.widgets];
      const removed = newWidgets.splice(sourceIndex, 1);
      newWidgets.splice(targetIndex, 0, removed[0]);
      this.props.onUpdate(newWidgets);
    }

    this.setState({
      isDragging: false,
      left: undefined,
      top: undefined,
      draggingIndex: undefined,
      draggingTargetIndex: undefined,
      ghostTopOffset: 0,
      ghostLeftOffset: 0,
      widgets: undefined,
    });
  };

  renderWidget(widget: Widget, index: number) {
    const {isEditing} = this.props;

    return (
      <LazyLoad key={`${widget.id ?? index}`} once height={240} offset={100}>
        <WidgetWrapper data-component="widget-wrapper">
          <WidgetCard
            widget={widget}
            isEditing={isEditing}
            onDelete={this.handleDeleteWidget(index)}
            onEdit={this.handleEditWidget(widget, index)}
            isDragging={this.state.isDragging && this.state.draggingTargetIndex === index}
            hideToolbar={this.state.isDragging}
            startWidgetDrag={this.startWidgetDrag(index)}
          />
        </WidgetWrapper>
      </LazyLoad>
    );
  }

  renderGhost = () => {
    if (!this.portal) {
      return null;
    }
    const {ghostLeftOffset, ghostTopOffset} = this.state;

    const top = typeof this.state.top === 'number' ? this.state.top - ghostTopOffset : 0;
    const left =
      typeof this.state.left === 'number' ? this.state.left - ghostLeftOffset : 0;

    const ghost = (
      <WidgetGhost
        id="ghost"
        ref={this.dragGhostRef}
        style={{top: `${top}px`, left: `${left}px`}}
      />
    );

    return ReactDOM.createPortal(ghost, this.portal);
  };

  render() {
    const {isEditing, dashboard} = this.props;

    const widgets =
      this.state.isDragging && this.state.widgets
        ? this.state.widgets
        : dashboard.widgets;

    return (
      <WidgetContainer>
        {widgets.map((widget, i) => this.renderWidget(widget, i))}
        {isEditing && (
          <WidgetWrapper key="add">
            <AddWidgetWrapper
              key="add"
              data-test-id="widget-add"
              onClick={this.handleStartAdd}
            >
              <IconAdd size="lg" isCircled color="inactive" />
            </AddWidgetWrapper>
          </WidgetWrapper>
        )}
        {this.renderGhost()}
      </WidgetContainer>
    );
  }
}

export default withApi(withGlobalSelection(Dashboard));

const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr;
  }
`;

const WidgetWrapper = styled('div')`
  position: relative;
  /* Min-width prevents grid items from stretching the grid */
  min-width: 200px;
`;

const AddWidgetWrapper = styled('a')`
  width: 100%;
  height: 100%;
  min-height: 200px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const WidgetGhost = styled('div')`
  display: block;
  position: absolute;
  cursor: grabbing;
  opacity: 0.8;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border-radius: ${p => p.theme.borderRadius};
`;
