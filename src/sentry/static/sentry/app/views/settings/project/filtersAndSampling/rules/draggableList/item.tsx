import React from 'react';
import {DraggableSyntheticListeners} from '@dnd-kit/core';
import {useSortable} from '@dnd-kit/sortable';
import {Transform} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

type UseSortableOutputProps = ReturnType<typeof useSortable>;

export type ItemProps = {
  value: React.ReactNode;
  renderItem(args: {
    dragging: boolean;
    sorting: boolean;
    value: ItemProps['value'];
    index?: ItemProps['index'];
    listeners?: ItemProps['listeners'];
    transform?: ItemProps['transform'];
    transition?: ItemProps['transition'];
    attributes?: ItemProps['attributes'];
  }): React.ReactElement | null;
  dragging?: boolean;
  index?: number;
  transform?: Transform | null;
  listeners?: DraggableSyntheticListeners;
  sorting?: boolean;
  transition?: string;
  forwardRef?: React.Ref<HTMLElement>;
  attributes?: UseSortableOutputProps['attributes'];
  wrapperStyle?: React.CSSProperties;
  innerWrapperStyle?: React.CSSProperties;
};

function Item({
  value,
  dragging,
  index,
  transform,
  listeners,
  sorting,
  transition,
  forwardRef,
  attributes,
  renderItem,
  wrapperStyle,
  innerWrapperStyle,
}: ItemProps) {
  return (
    <Wrapper
      ref={forwardRef as React.Ref<HTMLDivElement> | undefined}
      style={
        {
          ...wrapperStyle,
          transition,
          '--translate-x': transform ? `${Math.round(transform.x)}px` : undefined,
          '--translate-y': transform ? `${Math.round(transform.y)}px` : undefined,
          '--scale-x': transform?.scaleX ? `${transform.scaleX}` : undefined,
          '--scale-y': transform?.scaleY ? `${transform.scaleY}` : undefined,
        } as React.CSSProperties
      }
    >
      <InnerWrapper style={innerWrapperStyle}>
        {renderItem({
          dragging: Boolean(dragging),
          sorting: Boolean(sorting),
          listeners,
          transform,
          transition,
          value,
          index,
          attributes,
        })}
      </InnerWrapper>
    </Wrapper>
  );
}

export default Item;

const boxShadowBorder = '0 0 0 calc(1px / var(--scale-x, 1)) rgba(63, 63, 68, 0.05)';
const boxShadowCommon = '0 1px calc(3px / var(--scale-x, 1)) 0 rgba(34, 33, 81, 0.15)';
const boxShadow = `${boxShadowBorder}, ${boxShadowCommon}`;

const Wrapper = styled('div')`
  transform: translate3d(var(--translate-x, 0), var(--translate-y, 0), 0)
    scaleX(var(--scale-x, 1)) scaleY(var(--scale-y, 1));
  transform-origin: 0 0;
  touch-action: manipulation;
  --box-shadow: ${boxShadow};
  --box-shadow-picked-up: ${boxShadowBorder}, -1px 0 15px 0 rgba(34, 33, 81, 0.01),
    0px 15px 15px 0 rgba(34, 33, 81, 0.25);
`;

const InnerWrapper = styled('div')`
  background-color: ${p => p.theme.white};

  animation: pop 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);
  box-shadow: var(--box-shadow-picked-up);
  opacity: 1;

  :focus {
    box-shadow: 0 0px 4px 1px rgba(76, 159, 254, 1), ${boxShadow};
  }

  @keyframes pop {
    0% {
      transform: scale(1);
      box-shadow: var(--box-shadow);
    }
    100% {
      box-shadow: var(--box-shadow-picked-up);
    }
  }
`;
