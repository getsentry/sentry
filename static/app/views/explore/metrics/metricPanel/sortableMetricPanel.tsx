import {useEffect} from 'react';
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
  onEquationLabelsChange?: (equationLabel: string, labels: string[]) => void;
  onNewlyAdded?: (panel: HTMLElement) => void;
  referenceMap?: Record<string, string>;
  referencedMetricLabels?: Set<string>;
}

export function SortableMetricPanel({
  sortableId,
  traceMetric,
  queryIndex,
  queryLabel,
  referenceMap,
  referencedMetricLabels,
  onEquationLabelsChange,
  isAnyDragging,
  onNewlyAdded,
  canDrag,
}: SortableMetricPanelProps) {
  const {attributes, listeners, node, setNodeRef, transform, isDragging} = useSortable({
    id: sortableId,
    transition: null,
  });

  useEffect(() => {
    if (onNewlyAdded && node.current) {
      onNewlyAdded(node.current);
    }
  }, [node, onNewlyAdded]);

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
      dragAttributes={attributes}
      referencedMetricLabels={referencedMetricLabels}
      onEquationLabelsChange={onEquationLabelsChange}
    />
  );
}
