import {useCallback, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space, type ValidSize} from 'sentry/styles/space';
import {useRefChildrenVisibility} from 'sentry/utils/useRefChildrenVisibility';

interface ScrollCarouselProps {
  'aria-label': string;
  children: React.ReactNode;
  className?: string;
  'data-test-id'?: string;
  gap?: ValidSize;
  jumpItemCount?: number;
  transparentMask?: boolean;
}

/**
 * This number determines what percentage of an element must be within the
 * visible scroll region for it to be considered 'visible'. If it is visible
 * but slightly off screen it will be skipped when scrolling
 *
 * For example, if set to 0.85, and 15% of the element is out of the scroll
 * area to the right, pressing the right arrow will skip over scrolling to
 * this element, and will scroll to the next invisible one.
 */
const DEFAULT_VISIBLE_RATIO = 0.85;

/**
 * This number determines how many items to jump when scrolling left or right
 * when the arrow buttons are clicked
 */
const DEFAULT_JUMP_ITEM_COUNT = 2;

/**
 * Calculates the offset rectangle of an element relative to another element.
 */
const getOffsetRect = (el: HTMLElement, relativeTo: HTMLElement) => {
  const rect = el.getBoundingClientRect();
  if (!relativeTo) {
    return rect;
  }
  const relativeRect = relativeTo.getBoundingClientRect();
  return {
    left: rect.left - relativeRect.left,
    top: rect.top - relativeRect.top,
    right: rect.right - relativeRect.left,
    bottom: rect.bottom - relativeRect.top,
    width: rect.width,
    height: rect.height,
  };
};

export function ScrollCarousel({
  children,
  gap = 1,
  transparentMask = false,
  jumpItemCount = DEFAULT_JUMP_ITEM_COUNT,
  ...props
}: ScrollCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {visibility, childrenEls} = useRefChildrenVisibility({
    children,
    scrollContainerRef,
    visibleRatio: DEFAULT_VISIBLE_RATIO,
  });

  const isAtStart = visibility.at(0) ?? true;
  const isAtEnd = visibility.at(-1) ?? true;

  const scrollLeft = useCallback(() => {
    const scrollIndex = visibility.findIndex(Boolean);
    // Clamp the scroll index to the first visible item
    const clampedIndex = Math.max(scrollIndex - jumpItemCount, 0);
    // scrollIntoView scrolls the entire page on some browsers
    scrollContainerRef.current?.scrollTo({
      behavior: 'smooth',
      // We don't need to do any fancy math for the left edge
      left: getOffsetRect(childrenEls[clampedIndex], childrenEls[0]).left,
    });
  }, [visibility, childrenEls, jumpItemCount]);

  const scrollRight = useCallback(() => {
    const scrollIndex = visibility.findLastIndex(Boolean);
    // Clamp the scroll index to the last visible item
    const clampedIndex = Math.min(scrollIndex + jumpItemCount, visibility.length - 1);

    const targetElement = childrenEls[clampedIndex];
    const targetElementRight = getOffsetRect(targetElement, childrenEls[0]).right;
    const containerRight = scrollContainerRef.current?.clientWidth ?? 0;
    // scrollIntoView scrolls the entire page on some browsers
    scrollContainerRef.current?.scrollTo({
      behavior: 'smooth',
      left: Math.max(targetElementRight - containerRight, 0),
    });
  }, [visibility, childrenEls, jumpItemCount]);

  return (
    <ScrollCarouselWrapper>
      <ScrollContainer
        ref={scrollContainerRef}
        style={{gap: space(gap)}}
        role="group"
        {...props}
      >
        {children}
      </ScrollContainer>
      {!isAtStart && <LeftMask transparentMask={transparentMask} />}
      {!isAtEnd && <RightMask transparentMask={transparentMask} />}
      {!isAtStart && (
        <StyledArrowButton
          onClick={scrollLeft}
          style={{left: 0}}
          aria-label={t('Scroll left')}
          icon={<StyledIconChevron direction="left" />}
          borderless
        />
      )}
      {!isAtEnd && (
        <StyledArrowButton
          onClick={scrollRight}
          style={{right: 0}}
          aria-label={t('Scroll right')}
          icon={<StyledIconChevron direction="right" />}
          borderless
        />
      )}
    </ScrollCarouselWrapper>
  );
}

const ScrollCarouselWrapper = styled('div')`
  position: relative;
  overflow: hidden;
`;

const ScrollContainer = styled('div')`
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;

  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
  &::-webkit-scrollbar {
    display: none;
  }
`;

const StyledArrowButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  min-height: 14px;
  height: 14px;
  width: 14px;
  padding: 10px;
  border-radius: 100%;
  z-index: 1;
  color: ${p => p.theme.subText};
  opacity: 0.6;
  background-color: ${p => p.theme.background};

  &:hover {
    opacity: 1;
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const Mask = css`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  pointer-events: none;
  z-index: 1;
`;

const LeftMask = styled('div')<{transparentMask: boolean}>`
  ${Mask}
  left: 0;
  background: ${p =>
    p.transparentMask
      ? `linear-gradient(to left, ${Color(p.theme.background).alpha(0).rgb().string()}, ${p.theme.background})`
      : `linear-gradient(
    90deg,
    ${p.theme.background} 50%,
    ${Color(p.theme.background).alpha(0.09).rgb().string()} 100%
  )`};
`;

const RightMask = styled('div')<{transparentMask: boolean}>`
  ${Mask}
  right: 0;
  background: ${p =>
    p.transparentMask
      ? 'linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))'
      : `linear-gradient(
    270deg,
    ${p.theme.background} 50%,
    ${Color(p.theme.background).alpha(0.09).rgb().string()} 100%
  )`};
`;

const StyledIconChevron = styled(IconChevron)`
  margin-left: 1px;
`;
