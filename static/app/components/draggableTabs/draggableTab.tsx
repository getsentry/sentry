import type React from 'react';
import {forwardRef, Fragment, useCallback, useRef} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {
  type DropIndicatorProps,
  useDrag,
  useDropIndicator,
  useDroppableItem,
} from '@react-aria/dnd';
import {useFocusRing} from '@react-aria/focus';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {mergeProps, useObjectRef} from '@react-aria/utils';
import type {DroppableCollectionState} from '@react-stately/dnd';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';

import {tabsShouldForwardProp} from './utils';

interface DraggableTabProps extends AriaTabProps {
  dropState: DroppableCollectionState;
  item: Node<any>;
  orientation: Orientation;
  /**
   * Whether this tab is overflowing the TabList container. If so, the tab
   * needs to be visually hidden. Users can instead select it via an overflow
   * menu.
   */
  overflowing: boolean;
  state: TabListState<any>;
}

interface BaseDropIndicatorProps {
  dropState: DroppableCollectionState;
  target: DropIndicatorProps['target'];
}

/**
 * Stops event propagation if the command/ctrl/shift key is pressed, in effect
 * preventing any state change. This is useful because when a user
 * command/ctrl/shift-clicks on a tab link, the intention is to view the tab
 * in a new browser tab/window, not to update the current view.
 */
function handleLinkClick(e: React.PointerEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.stopPropagation();
  }
}

function TabDropIndicator(props: BaseDropIndicatorProps) {
  const ref = useRef(null);
  const {dropIndicatorProps, isHidden, isDropTarget} = useDropIndicator(
    props,
    props.dropState,
    ref
  );
  if (isHidden) {
    return null;
  }

  return (
    <TabSeparator
      {...dropIndicatorProps}
      role="option"
      ref={ref}
      className={`drop-indicator ${isDropTarget ? 'drop-target' : ''}`}
    />
  );
}

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
function BaseDraggableTab(
  {item, state, orientation, overflowing, dropState}: DraggableTabProps,
  forwardedRef: React.ForwardedRef<HTMLLIElement>
) {
  const ref = useObjectRef(forwardedRef);

  const {isFocusVisible} = useFocusRing();

  const {
    key,
    rendered,
    props: {to, hidden},
  } = item;
  const {tabProps, isSelected} = useTab({key, isDisabled: hidden}, state, ref);

  const InnerWrap = useCallback(
    ({children}) =>
      to ? (
        <TabLink
          to={to}
          onMouseDown={handleLinkClick}
          onPointerDown={handleLinkClick}
          orientation={orientation}
          tabIndex={-1}
        >
          {children}
        </TabLink>
      ) : (
        <TabInnerWrap orientation={orientation}>{children}</TabInnerWrap>
      ),
    [to, orientation]
  );

  const {dropProps, isDropTarget} = useDroppableItem(
    {
      target: {type: 'item', key: item.key, dropPosition: 'on'},
    },
    dropState,
    ref
  );

  function Draggable({children}) {
    const {dragProps, dragButtonProps, isDragging} = useDrag({
      getAllowedDropOperations: () => ['move'],
      getItems() {
        return [
          {
            tab: JSON.stringify({key: item.key, value: children}),
          },
        ];
      },
    });

    const draggableRef = useRef(null);
    const {buttonProps} = useButton(
      {...dragButtonProps, elementType: 'div'},
      draggableRef
    );

    return (
      <div
        {...mergeProps(dragProps, buttonProps)}
        ref={draggableRef}
        className={`draggable ${isDragging ? 'dragging' : ''}`}
      >
        {children}
      </div>
    );
  }

  return (
    <Fragment>
      <TabDropIndicator
        target={{type: 'item', key: item.key, dropPosition: 'before'}}
        dropState={dropState}
      />
      <TabWrap
        {...mergeProps(tabProps, dropProps)}
        hidden={hidden}
        selected={isSelected}
        overflowing={overflowing}
        ref={ref}
        className={`option ${isFocusVisible ? 'focus-visible' : ''} ${
          isDropTarget ? 'drop-target' : ''
        }`}
      >
        <InnerWrap>
          <StyledInteractionStateLayer
            orientation={orientation}
            higherOpacity={isSelected}
          />
          <FocusLayer orientation={orientation} />
          <Draggable>{rendered}</Draggable>
          <TabSelectionIndicator orientation={orientation} selected={isSelected} />
        </InnerWrap>
      </TabWrap>
      {state.collection.getKeyAfter(item.key) == null && (
        <TabDropIndicator
          target={{type: 'item', key: item.key, dropPosition: 'after'}}
          dropState={dropState}
        />
      )}
    </Fragment>
  );
}

export const DraggableTab = forwardRef(BaseDraggableTab);

const TabWrap = styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
  overflowing: boolean;
  selected: boolean;
}>`
  color: ${p => (p.selected ? p.theme.activeText : p.theme.textColor)};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: ${p => (p.selected ? p.theme.activeText : p.theme.headingColor)};
  }

  &:focus {
    outline: none;
  }

  &[aria-disabled],
  &[aria-disabled]:hover {
    color: ${p => p.theme.subText};
    pointer-events: none;
    cursor: default;
  }

  ${p =>
    p.overflowing &&
    `
      opacity: 0;
      pointer-events: none;
    `}
`;

const TabSeparator = styled('li')`
  height: 80%;
  width: 2px;
  background-color: ${p => p.theme.gray200};
`;

const innerWrapStyles = ({
  theme,
  orientation,
}: {
  orientation: Orientation;
  theme: Theme;
}) => `
  display: flex;
  align-items: center;
  position: relative;
  height: calc(
    ${theme.form.sm.height}px +
      ${orientation === 'horizontal' ? space(0.75) : '0px'}
  );
  border-radius: ${theme.borderRadius};
  transform: translateY(1px);

  ${
    orientation === 'horizontal'
      ? `
        /* Extra padding + negative margin trick, to expand click area */
        padding: ${space(0.75)} ${space(1)} ${space(1.5)};
        margin-left: -${space(1)};
        margin-right: -${space(1)};
      `
      : `padding: ${space(0.75)} ${space(2)};`
  };
`;

const TabLink = styled(Link)<{orientation: Orientation}>`
  ${innerWrapStyles}

  &,
  &:hover {
    color: inherit;
  }
`;

const TabInnerWrap = styled('span')<{orientation: Orientation}>`
  ${innerWrapStyles}
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)<{
  orientation: Orientation;
}>`
  position: absolute;
  width: auto;
  height: auto;
  transform: none;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)};
`;

const FocusLayer = styled('div')<{orientation: Orientation}>`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)};

  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
  transition: box-shadow 0.1s ease-out;

  li:focus-visible & {
    box-shadow:
      ${p => p.theme.focusBorder} 0 0 0 1px,
      inset ${p => p.theme.focusBorder} 0 0 0 1px;
  }
`;

const TabSelectionIndicator = styled('div')<{
  orientation: Orientation;
  selected: boolean;
}>`
  position: absolute;
  border-radius: 2px;
  pointer-events: none;
  background: ${p => (p.selected ? p.theme.active : 'transparent')};
  transition: background 0.1s ease-out;

  li[aria-disabled='true'] & {
    background: ${p => (p.selected ? p.theme.subText : 'transparent')};
  }

  ${p =>
    p.orientation === 'horizontal'
      ? `
        width: calc(100% - ${space(2)});
        height: 3px;

        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
      `
      : `
        width: 3px;
        height: 50%;

        left: 0;
        top: 50%;
        transform: translateY(-50%);
      `};
`;
