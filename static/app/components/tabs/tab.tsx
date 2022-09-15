import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {useTab} from '@react-aria/tabs';
import {mergeProps} from '@react-aria/utils';
import {TabListState} from '@react-stately/tabs';
import {Node, Orientation} from '@react-types/shared';

import space from 'sentry/styles/space';

interface TabProps<T> {
  item: Node<T>;
  orientation: Orientation;
  overflowing: boolean;
  setRef: (ref: React.RefObject<HTMLLIElement>) => void;
  state: TabListState<T>;
}

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
export function Tab<T>({item, state, orientation, overflowing, setRef}: TabProps<T>) {
  const ref = useRef<HTMLLIElement>(null);

  const {key, rendered} = item;
  const {tabProps, isSelected, isDisabled} = useTab({key}, state, ref);

  useEffect(() => {
    // Send ref object to parent (TabsList), so TabsList can use IntersectionObserver to
    // detect if this tab is overflowing the outer wrap (in which case this tab will be
    // moved to an overflow menu)
    setRef(ref);
  }, [setRef]);

  return (
    <TabWrap
      {...mergeProps(tabProps)}
      disabled={isDisabled}
      selected={isSelected}
      overflowing={overflowing}
      orientation={orientation}
      ref={ref}
    >
      <HoverLayer orientation={orientation} />
      <FocusLayer orientation={orientation} />
      {rendered}
      <TabSelectionIndicator orientation={orientation} selected={isSelected} />
    </TabWrap>
  );
}

const TabWrap = styled('li')<{
  disabled: boolean;
  orientation: Orientation;
  overflowing: boolean;
  selected: boolean;
}>`
  display: flex;
  align-items: center;
  position: relative;
  height: calc(
    ${p => p.theme.form.sm.height}px +
      ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)}
  );
  border-radius: ${p => p.theme.borderRadius};
  transform: translateY(1px);

  ${p =>
    p.orientation === 'horizontal'
      ? `
        /* Extra padding + negative margin trick, to expand click area */
        padding: ${space(0.75)} ${space(1)} ${space(1.5)};
        margin-left: -${space(1)};
        margin-right: -${space(1)};
      `
      : `padding: ${space(0.75)} ${space(2)};`};

  color: ${p => (p.selected ? p.theme.activeText : p.theme.textColor)};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: ${p => (p.selected ? p.theme.activeText : p.theme.headingColor)};
  }

  &:focus {
    outline: none;
  }

  ${p =>
    p.disabled &&
    `
      &, &:hover {
        color: ${p.theme.subText};
        pointer-events: none;
      }
    `}

  ${p => p.overflowing && `opacity: 0;`}
`;

const HoverLayer = styled('div')<{orientation: Orientation}>`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)};

  pointer-events: none;
  background-color: currentcolor;
  border-radius: inherit;
  z-index: 0;

  opacity: 0;
  transition: opacity 0.1s ease-out;

  li:hover:not(.focus-visible) > & {
    opacity: 0.06;
  }

  ${p =>
    p.orientation === 'vertical' &&
    `
      li[aria-selected='true']:not(.focus-visible) > & {
        opacity: 0.06;
      }
    `}
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

  li.focus-visible > & {
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px,
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
