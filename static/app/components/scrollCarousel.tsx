import {useCallback, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import {Button} from 'sentry/components/core/button';
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
  orientation?: 'horizontal' | 'vertical';
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
  orientation = 'horizontal',
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
  const isVertical = orientation === 'vertical';

  const scrollLeft = useCallback(() => {
    const scrollIndex = visibility.findIndex(Boolean);
    // Clamp the scroll index to the first visible item
    const clampedIndex = Math.max(scrollIndex - jumpItemCount, 0);
    // scrollIntoView scrolls the entire page on some browsers
    const offsetRect = getOffsetRect(childrenEls[clampedIndex]!, childrenEls[0]!);
    scrollContainerRef.current?.scrollTo({
      behavior: 'smooth',
      ...(isVertical ? {top: offsetRect.top} : {left: offsetRect.left}),
    });
  }, [visibility, childrenEls, jumpItemCount, isVertical]);

  const scrollRight = useCallback(() => {
    const scrollIndex = visibility.findLastIndex(Boolean);
    // Clamp the scroll index to the last visible item
    const clampedIndex = Math.min(scrollIndex + jumpItemCount, visibility.length - 1);

    const targetElement = childrenEls[clampedIndex]!;
    const targetRect = getOffsetRect(targetElement, childrenEls[0]!);
    const targetEnd = isVertical ? targetRect.bottom : targetRect.right;
    const containerSize = isVertical
      ? (scrollContainerRef.current?.clientHeight ?? 0)
      : (scrollContainerRef.current?.clientWidth ?? 0);
    // scrollIntoView scrolls the entire page on some browsers
    scrollContainerRef.current?.scrollTo({
      behavior: 'smooth',
      ...(isVertical
        ? {top: Math.max(targetEnd - containerSize, 0)}
        : {left: Math.max(targetEnd - containerSize, 0)}),
    });
  }, [visibility, childrenEls, jumpItemCount, isVertical]);

  return (
    <ScrollCarouselWrapper orientation={orientation}>
      <ScrollContainer
        ref={scrollContainerRef}
        style={{gap: space(gap)}}
        orientation={orientation}
        role="group"
        {...props}
      >
        {children}
      </ScrollContainer>
      {!isAtStart &&
        (isVertical ? (
          <TopMask transparentMask={transparentMask} />
        ) : (
          <LeftMask transparentMask={transparentMask} />
        ))}
      {!isAtEnd &&
        (isVertical ? (
          <BottomMask transparentMask={transparentMask} />
        ) : (
          <RightMask transparentMask={transparentMask} />
        ))}
      {!isAtStart && (
        <StyledArrowButton
          onClick={scrollLeft}
          style={isVertical ? {top: 0} : {left: 0}}
          aria-label={isVertical ? t('Scroll up') : t('Scroll left')}
          icon={<StyledIconChevron direction={isVertical ? 'up' : 'left'} />}
          orientation={orientation}
          borderless
        />
      )}
      {!isAtEnd && (
        <StyledArrowButton
          onClick={scrollRight}
          style={isVertical ? {bottom: 0} : {right: 0}}
          aria-label={isVertical ? t('Scroll down') : t('Scroll right')}
          icon={<StyledIconChevron direction={isVertical ? 'down' : 'right'} />}
          orientation={orientation}
          borderless
        />
      )}
    </ScrollCarouselWrapper>
  );
}

const ScrollCarouselWrapper = styled('div')<{orientation: 'horizontal' | 'vertical'}>`
  position: relative;
  overflow: hidden;

  ${p =>
    p.orientation === 'vertical' &&
    css`
      height: 100%;
    `}
`;

const ScrollContainer = styled('div')<{orientation: 'horizontal' | 'vertical'}>`
  display: flex;
  ${p =>
    p.orientation === 'horizontal'
      ? css`
          flex-direction: row;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
        `
      : css`
          flex-direction: column;
          overflow-y: auto;
          overflow-x: hidden;
          height: 100%;
        `}

  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
  &::-webkit-scrollbar {
    display: none;
  }
`;

const StyledArrowButton = styled(Button)<{orientation: 'horizontal' | 'vertical'}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  ${p =>
    p.orientation === 'horizontal'
      ? css`
          top: 50%;
          transform: translateY(-50%);
        `
      : css`
          left: 50%;
          transform: translateX(-50%);
        `}
  min-height: 14px;
  height: 14px;
  width: 14px;
  padding: 10px;
  border-radius: 100%;
  z-index: 1;
  color: ${p => p.theme.tokens.content.secondary};
  opacity: 0.6;
  background-color: ${p => p.theme.tokens.background.primary};

  &:hover {
    opacity: 1;
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
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
      ? `linear-gradient(to left, ${Color(p.theme.tokens.background.primary).alpha(0).rgb().string()}, ${p.theme.tokens.background.primary})`
      : `linear-gradient(
    90deg,
    ${p.theme.tokens.background.primary} 50%,
    ${Color(p.theme.tokens.background.primary).alpha(0.09).rgb().string()} 100%
  )`};
`;

const RightMask = styled('div')<{transparentMask: boolean}>`
  ${Mask}
  right: 0;
  background: ${p =>
    p.transparentMask
      ? `linear-gradient(to right, transparent, ${p.theme.tokens.background.primary})`
      : `linear-gradient(
    270deg,
    ${p.theme.tokens.background.primary} 50%,
    ${Color(p.theme.tokens.background.primary).alpha(0.09).rgb().string()} 100%
  )`};
`;

const VerticalMask = css`
  position: absolute;
  left: 0;
  right: 0;
  height: 40px;
  pointer-events: none;
  z-index: 1;
`;

const TopMask = styled('div')<{transparentMask: boolean}>`
  ${VerticalMask}
  top: 0;
  background: ${p =>
    p.transparentMask
      ? `linear-gradient(to top, ${Color(p.theme.tokens.background.primary).alpha(0).rgb().string()}, ${p.theme.tokens.background.primary})`
      : `linear-gradient(
    180deg,
    ${p.theme.tokens.background.primary} 50%,
    ${Color(p.theme.tokens.background.primary).alpha(0.09).rgb().string()} 100%
  )`};
`;

const BottomMask = styled('div')<{transparentMask: boolean}>`
  ${VerticalMask}
  bottom: 0;
  background: ${p =>
    p.transparentMask
      ? `linear-gradient(to bottom, transparent, ${p.theme.tokens.background.primary})`
      : `linear-gradient(
    0deg,
    ${p.theme.tokens.background.primary} 50%,
    ${Color(p.theme.tokens.background.primary).alpha(0.09).rgb().string()} 100%
  )`};
`;

const StyledIconChevron = styled(IconChevron)`
  margin-left: 1px;
`;
