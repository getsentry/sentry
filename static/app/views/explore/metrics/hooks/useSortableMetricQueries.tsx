import {useCallback, useMemo, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {KeyboardSensor, PointerSensor, useSensor, useSensors} from '@dnd-kit/core';
import {arrayMove, sortableKeyboardCoordinates} from '@dnd-kit/sortable';

import {
  useMultiMetricsQueryParams,
  useReorderMetricQueries,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

export function useSortableMetricQueries() {
  const metricQueries = useMultiMetricsQueryParams();
  const reorderMetricQueries = useReorderMetricQueries();
  const [isDragging, setIsDragging] = useState(false);

  const sortableItems = useMemo(() => {
    return metricQueries.map((metricQuery, index) => ({
      id: metricQuery.label ?? String(index),
      metricQuery,
    }));
  }, [metricQueries]);

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
        const oldIndex = sortableItems.findIndex(({id}) => id === active.id);
        const newIndex = sortableItems.findIndex(({id}) => id === over?.id);

        if (oldIndex < 0 || newIndex < 0) return;

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
