import React from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {useSortable} from '@dnd-kit/sortable';
import {Transform} from '@dnd-kit/utilities';

type Props = {
  id: string;
  renderItem(args: {
    value: React.ReactNode;
    attributes?: UseDraggableArguments['attributes'];
    listeners?: DraggableSyntheticListeners;
    transform?: Transform | null;
    transition?: string;
    style?: React.CSSProperties;
    forwardRef?: React.Ref<HTMLElement>;
  }): React.ReactElement | null;
};

function SortableItem({id, renderItem}: Props) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id});

  return renderItem({
    forwardRef: setNodeRef,
    value: id,
    transform,
    transition,
    listeners,
    attributes,
  });
}

export default SortableItem;
