import {useCallback, useMemo, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {KeyboardSensor, PointerSensor, useSensor, useSensors} from '@dnd-kit/core';
import {arrayMove, sortableKeyboardCoordinates} from '@dnd-kit/sortable';

import {
  useReorderSpanCards,
  useSpanCards,
} from 'sentry/views/explore/spans/spanCardsQueryParams';

export function useSortableSpanCards() {
  const cards = useSpanCards();
  const reorderSpanCards = useReorderSpanCards();
  const [isDragging, setIsDragging] = useState(false);

  const sortableItems = useMemo(
    () =>
      cards.map((card, index) => ({
        id: card.label,
        card,
        index,
      })),
    [cards]
  );

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

        if (oldIndex === undefined || newIndex === undefined) {
          return;
        }

        reorderSpanCards(arrayMove([...cards], oldIndex, newIndex), oldIndex, newIndex);
      }
    },
    [cards, reorderSpanCards, sortableItems]
  );

  const onDragCancel = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel, isDragging};
}
