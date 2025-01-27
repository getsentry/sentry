import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useRefChildrenVisibility} from 'sentry/utils/useRefChildrenVisibility';

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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {visibility, childrenEls} = useRefChildrenVisibility({
    children,
    scrollContainerRef,
    visibleRatio,
  });

  const isAtStart = visibility[0];
  const isAtEnd = visibility[visibility.length - 1];

  const scrollLeft = useCallback(
    () =>
      childrenEls[visibility.findIndex(Boolean) - 1]!.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      }),
    [visibility, childrenEls]
  );

  const scrollRight = useCallback(
    () =>
      childrenEls[visibility.findLastIndex(Boolean) + 1]!.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'end',
      }),
    [visibility, childrenEls]
  );

  return (
    <CarouselContainer>
      <CarouselItems ref={scrollContainerRef}>{children}</CarouselItems>
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
