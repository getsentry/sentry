import React from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {Transform} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

export type ItemProps = {
  value: React.ReactNode;
  dragging?: boolean;
  index?: number;
  transform?: Transform | null;
  listeners?: DraggableSyntheticListeners;
  sorting?: boolean;
  transition?: string;
  forwardRef?: React.Ref<HTMLElement>;
  attributes?: UseDraggableArguments['attributes'];
  style?: React.CSSProperties;
  wrapperStyle?: React.CSSProperties;
  innerWrapperStyle?: React.CSSProperties;
  renderItem(args: {
    dragging: boolean;
    sorting: boolean;
    listeners: DraggableSyntheticListeners;
    transform: ItemProps['transform'];
    transition: ItemProps['transition'];
    value: ItemProps['value'];
    style?: React.CSSProperties;
    index?: number;
    attributes?: UseDraggableArguments['attributes'];
  }): React.ReactElement | null;
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
  style,
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
          style,
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
  position: relative;
  background-color: ${p => p.theme.white};
  -webkit-tap-highlight-color: transparent;
  transition: box-shadow 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);

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
