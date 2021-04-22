import React, {useEffect} from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import {useSortable} from '@dnd-kit/sortable';
import {Location} from 'history';

import {Client} from 'app/api';
import {GlobalSelection, Organization, Project} from 'app/types';
import theme from 'app/utils/theme';
import withProjects from 'app/utils/withProjects';

import MetricWidgetCard from './widget/metricWidget/card';
import {EventWidget, MetricWidget, Widget} from './widget/types';
import WidgetCard from './widgetCard';
import WidgetWrapper from './widgetWrapper';

const initialStyles: React.ComponentProps<typeof WidgetWrapper>['animate'] = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  zIndex: 'auto',
};

type Props = {
  api: Client;
  location: Location;
  projects: Project[];
  organization: Organization;
  selection: GlobalSelection;
  router: InjectedRouter;
  widget: Widget;
  dragId: string;
  isEditing: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

function SortableWidget(props: Props) {
  const {
    api,
    location,
    projects,
    organization,
    selection,
    router,
    widget,
    dragId,
    isEditing,
    onDelete,
    onEdit,
  } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: currentWidgetDragging,
    isSorting,
  } = useSortable({
    id: dragId,
    transition: null,
  });

  useEffect(() => {
    if (!currentWidgetDragging) {
      return undefined;
    }

    document.body.style.cursor = 'grabbing';

    return function cleanup() {
      document.body.style.cursor = '';
    };
  }, [currentWidgetDragging]);

  function renderCard() {
    const isMetricWidget = (widget as MetricWidget).metrics_queries;

    if (isMetricWidget) {
      const metricWidget = widget as MetricWidget;

      const {projectId, conditions: searchQuery} = metricWidget.metrics_queries[0];
      const widgetProject = projects.find(project => project.id === projectId)!;

      const groupings = metricWidget.metrics_queries.map(({name, fields, groupBy}) => {
        const aggregation = fields[0].substr(0, fields[0].indexOf('('));
        return {
          legend: !!name ? name : undefined,
          aggregation,
          groupBy: !!groupBy ? groupBy.split(' ') : undefined,
          metricMeta: {
            name: fields[0].substr(aggregation.length).replace(/["'()]/g, ''),
            operations: [aggregation],
          },
        };
      });

      const {displayType, title} = widget;

      return (
        <MetricWidgetCard
          api={api}
          router={router}
          location={location}
          selection={selection}
          organization={organization}
          project={widgetProject}
          widget={{title, searchQuery, displayType, groupings}}
        />
      );
    }

    return (
      <WidgetCard
        widget={widget as EventWidget}
        isEditing={isEditing}
        onDelete={onDelete}
        onEdit={onEdit}
        isSorting={isSorting}
        hideToolbar={isSorting}
        currentWidgetDragging={currentWidgetDragging}
        draggableProps={{
          attributes,
          listeners,
        }}
        showContextMenu
      />
    );
  }

  return (
    <WidgetWrapper
      ref={setNodeRef}
      displayType={widget.displayType}
      layoutId={dragId}
      style={{
        // Origin is set to top right-hand corner where the drag handle is placed.
        // Otherwise, set the origin to be the top left-hand corner when swapping widgets.
        originX: currentWidgetDragging ? 1 : 0,
        originY: 0,
        boxShadow: currentWidgetDragging ? theme.dropShadowHeavy : 'none',
        borderRadius: currentWidgetDragging ? theme.borderRadius : undefined,
      }}
      animate={
        transform
          ? {
              x: transform.x,
              y: transform.y,
              scaleX: transform?.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
              scaleY: transform?.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
              zIndex: currentWidgetDragging ? theme.zIndex.modal : 'auto',
            }
          : initialStyles
      }
      transition={{
        duration: !currentWidgetDragging ? 0.25 : 0,
        easings: {
          type: 'spring',
        },
      }}
    >
      {renderCard()}
    </WidgetWrapper>
  );
}

export default withProjects(SortableWidget);
