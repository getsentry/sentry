import {useCallback, useMemo, useRef, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {KeyboardSensor, PointerSensor, useSensor, useSensors} from '@dnd-kit/core';
import {arrayMove, sortableKeyboardCoordinates} from '@dnd-kit/sortable';

import {uniqueId} from 'sentry/utils/guid';
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMultiMetricsQueryParams,
  useReorderMetricQueries,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

export function useSortableMetricQueries() {
  const metricQueries = useMultiMetricsQueryParams();
  const reorderMetricQueries = useReorderMetricQueries();
  const [isDragging, setIsDragging] = useState(false);

  // Map from encoded query identity -> stable unique ID. Uses occurrence
  // count (not array index) to disambiguate duplicate queries, so keys
  // remain stable across reorders.
  const idMapRef = useRef<Map<string, string>>(new Map());
  const sortableItems = useMemo(() => {
    const activeKeys = new Set<string>();
    const occurrences = new Map<string, number>();

    const items = metricQueries.map((metricQuery, i) => {
      const encoded = encodeMetricQueryParams(metricQuery);

      const occurrence = occurrences.get(encoded) ?? 0;
      occurrences.set(encoded, occurrence + 1);

      const key = `${encoded}#${occurrence}`;
      activeKeys.add(key);

      let uid = idMapRef.current.get(key);
      if (!uid) {
        uid = uniqueId();
        idMapRef.current.set(key, uid);
      }

      return {id: i + 1, uniqueId: uid, metricQuery};
    });

    // Prune stale entries for queries that no longer exist.
    idMapRef.current.keys().forEach(key => {
      if (!activeKeys.has(key)) {
        idMapRef.current.delete(key);
      }
    });

    return items;
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

        reorderMetricQueries(arrayMove([...metricQueries], oldIndex, newIndex));
      }
    },
    [sortableItems, metricQueries, reorderMetricQueries]
  );

  const onDragCancel = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel, isDragging};
}
