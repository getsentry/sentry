import React from 'react';
import {DraggableSyntheticListeners} from '@dnd-kit/core';
import {Transform} from '@dnd-kit/utilities';

export interface Props {
  renderItem(args: {
    value: Props['value'];
    listeners: DraggableSyntheticListeners;
    transform: Props['transform'];
    transition: Props['transition'];
    style?: React.CSSProperties;
    forwardRef?: React.Ref<HTMLElement>;
  }): React.ReactElement | null;

  value: React.ReactNode;
  transform?: Transform | null;
  transition?: string;
  listeners?: DraggableSyntheticListeners;
  forwardRef?: React.Ref<HTMLLIElement>;
  style?: React.CSSProperties;
}

function Item({
  transition,
  transform,
  forwardRef,
  value,

  listeners,
  renderItem,
  style,
}: Props) {
  return renderItem({
    value,
    listeners,
    forwardRef,
    transform,
    transition,
    style,
  });
}

export default React.memo(Item);
