import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ScrollCarouselProps {
  children: React.ReactNode;
  className?: string;
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

export function ScrollCarousel({children, className}: ScrollCarouselProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [childrenEls, setChildrenEls] = useState<HTMLElement[]>([]);
  const [visibility, setVisibility] = useState<boolean[]>([]);

  const isAtStart = visibility.at(0);
  const isAtEnd = visibility.at(-1);

  useLayoutEffect(
    () => setChildrenEls(Array.from(ref.current?.children ?? []) as HTMLElement[]),
    [children]
  );

  useLayoutEffect(() => {
    if (!ref.current) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      entries => {
        setVisibility(currentVisibility => {
          return childrenEls.map((child, idx) => {
            const entry = entries.find(e => e.target === child);
            return entry !== undefined
              ? entry.intersectionRatio > DEFAULT_VISIBLE_RATIO
              : currentVisibility[idx] ?? false;
          });
        });
      },
      {
        root: ref.current,
        threshold: [DEFAULT_VISIBLE_RATIO],
      }
    );

    childrenEls.forEach(child => observer.observe(child));

    return () => observer.disconnect();
  }, [childrenEls]);

  const scrollLeft = useCallback(() => {
    const scrollIndex = visibility.findIndex(Boolean);
    // Clamp the scroll index to the first visible item
    const clampedIndex = Math.max(scrollIndex - DEFAULT_JUMP_ITEM_COUNT, 0);
    childrenEls[clampedIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }, [visibility, childrenEls]);

  const scrollRight = useCallback(() => {
    const scrollIndex = visibility.findLastIndex(Boolean);
    // Clamp the scroll index to the last visible item
    const clampedIndex = Math.min(
      scrollIndex + DEFAULT_JUMP_ITEM_COUNT,
      visibility.length - 1
    );
    childrenEls[clampedIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'end',
    });
  }, [visibility, childrenEls]);

  return (
    <ScrollCarouselWrapper>
      <ScrollContainer ref={ref} className={className}>
        {children}
      </ScrollContainer>
      {!isAtStart && <LeftMask />}
      {!isAtEnd && <RightMask />}
      {!isAtStart && (
        <StyledArrowButton
          onClick={scrollLeft}
          style={{left: 0}}
          aria-label={t('Scroll left')}
          icon={<IconArrow direction="left" />}
        />
      )}
      {!isAtEnd && (
        <StyledArrowButton
          onClick={scrollRight}
          style={{right: 0}}
          aria-label={t('Scroll right')}
          icon={<IconArrow direction="right" />}
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
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  min-height: 24px;
  height: 24px;
  width: 24px;
  border-radius: 100%;
  border: none;
  padding: 0;
  background-color: ${p => p.theme.background};
  z-index: 1;
  color: ${p => p.theme.subText};
`;

const Mask = css`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50px;
  pointer-events: none;
  z-index: 1;
`;

const LeftMask = styled('div')`
  ${Mask}
  left: 0;
  background: linear-gradient(90deg, #fff 50%, rgba(255, 255, 255, 0.09) 100%);
`;

const RightMask = styled('div')`
  ${Mask}
  right: 0;
  background: linear-gradient(270deg, #fff 50%, rgba(255, 255, 255, 0.09) 100%);
`;
