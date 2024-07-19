import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface CarouselProps {
  children?: React.ReactNode;
  /**
   * This number determines what percentage of an element must be within the
   * visible scroll region for it to be considered 'visible'. If it is visible
   * but slightly off screen it will be skipped when scrolling
   *
   * For example, if set to 0.8, and 10% of the element is out of the scroll
   * area to the right, pressing the right arrow will skip over scrolling to
   * this element, and will scroll to the next invisible one.
   *
   * @default 0.8
   */
  visibleRatio?: number;
}

function Carousel({children, visibleRatio = 0.8}: CarouselProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // The visibility match up to the elements list. Visibility of elements is
  // true if visible in the scroll container, false if outside.
  const [childrenEls, setChildrenEls] = useState<HTMLElement[]>([]);
  const [visibility, setVisibility] = useState<boolean[]>([]);

  const isAtStart = visibility[0];
  const isAtEnd = visibility[visibility.length - 1];

  // Update list of children element
  useEffect(
    () => setChildrenEls(Array.from(ref.current?.children ?? []) as HTMLElement[]),
    [children]
  );

  // Update the threshold list. This
  useEffect(() => {
    if (!ref.current) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      entries =>
        setVisibility(currentVisibility =>
          // Compute visibility list of the elements
          childrenEls.map((child, idx) => {
            const entry = entries.find(e => e.target === child);

            // NOTE: When the intersection observer fires, only elements that
            // have passed a threshold will be included in the entries list.
            // This is why we fallback to the currentThreshold value if there
            // was no entry for the child.
            return entry !== undefined
              ? entry.intersectionRatio > visibleRatio
              : currentVisibility[idx] ?? false;
          })
        ),
      {
        root: ref.current,
        threshold: [visibleRatio],
      }
    );

    childrenEls.map(child => observer.observe(child));

    return () => observer.disconnect();
  }, [childrenEls, visibleRatio]);

  const scrollLeft = useCallback(
    () =>
      childrenEls[visibility.findIndex(Boolean) - 1].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      }),
    [visibility, childrenEls]
  );

  const scrollRight = useCallback(
    () =>
      childrenEls[visibility.findLastIndex(Boolean) + 1].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'end',
      }),
    [visibility, childrenEls]
  );

  return (
    <CarouselContainer>
      <CarouselItems ref={ref}>{children}</CarouselItems>
      {!isAtStart && (
        <StyledArrowButton
          onClick={scrollLeft}
          direction="left"
          aria-label={t('Scroll left')}
          icon={<IconArrow direction="left" />}
        />
      )}
      {!isAtEnd && (
        <StyledArrowButton
          onClick={scrollRight}
          direction="right"
          aria-label={t('Scroll right')}
          icon={<IconArrow direction="right" />}
        />
      )}
    </CarouselContainer>
  );
}

const CarouselContainer = styled('div')`
  position: relative;
  /* We provide some margin to make room for the scroll bar. It is applied on
   * the top and bottom for consistency.
   */
  margin: ${space(0.25)};
`;

const CarouselItems = styled('div')`
  display: flex;
  overflow-x: scroll;
  scroll-behavior: smooth;
  /* We provide some margin to make room for the scroll bar. It is applied on
   * the top and bottom for consistency.
   */
  padding: ${space(1.5)} 0;
`;

const StyledArrowButton = styled(Button)<{direction: string}>`
  position: absolute;
  ${p => (p.direction === 'left' ? `left: 0;` : `right: 0;`)}
  top: 0;
  bottom: 0;
  height: 36px;
  width: 36px;
  border-radius: 50%;
  border: 1px solid ${p => p.theme.gray200};
  padding: 0;
  margin: auto;
  background-color: ${p => p.theme.background};
`;

export default Carousel;
