import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface SortableMetricPanelProps {
  canDrag: boolean;
  isAnyDragging: boolean;
  queryIndex: number;
  queryLabel: string;
  sortableId: string;
  traceMetric: TraceMetric;
  referenceMap?: Record<string, string>;
}

export function SortableMetricPanel({
  sortableId,
  traceMetric,
  queryIndex,
  queryLabel,
  referenceMap,
  isAnyDragging,
  canDrag,
}: SortableMetricPanelProps) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useSortable({
    id: sortableId,
    transition: null,
  });

  return (
    <MetricPanel
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
      }}
      traceMetric={traceMetric}
      queryIndex={queryIndex}
      queryLabel={queryLabel}
      referenceMap={referenceMap}
      dragListeners={canDrag ? listeners : undefined}
      isAnyDragging={isAnyDragging}
      isDragging={isDragging}
      {...attributes}
    />
  );
}
