import {useCallback, useMemo, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {KeyboardSensor, PointerSensor, useSensor, useSensors} from '@dnd-kit/core';
import {arrayMove, sortableKeyboardCoordinates} from '@dnd-kit/sortable';

import type {MetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMultiMetricsQueryParams,
  useReorderMetricQueries,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

interface UseSortableMetricQueriesOptions {
  predicate?: (metricQuery: MetricQuery) => boolean;
}

export function useSortableMetricQueries({
  predicate,
}: UseSortableMetricQueriesOptions = {}) {
  const metricQueries = useMultiMetricsQueryParams();
  const reorderMetricQueries = useReorderMetricQueries();
  const [isDragging, setIsDragging] = useState(false);

  const sortableItems = useMemo(() => {
    return metricQueries.flatMap((metricQuery, index) =>
      predicate?.(metricQuery) === false
        ? []
        : [
            {
              id: metricQuery.label ?? String(index),
              metricQuery,
              index,
            },
          ]
    );
  }, [metricQueries, predicate]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragging(false);
      const {active, over} = event;
      if (active.id !== over?.id) {
        const oldIndex = sortableItems.find(({id}) => id === active.id)?.index;
        const newIndex = sortableItems.find(({id}) => id === over?.id)?.index;

        if (oldIndex === undefined || newIndex === undefined) return;

        reorderMetricQueries(
          arrayMove([...metricQueries], oldIndex, newIndex),
          oldIndex,
          newIndex
        );
      }
    },
    [sortableItems, metricQueries, reorderMetricQueries]
  );

  const onDragCancel = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel, isDragging};
}
