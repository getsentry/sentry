import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useRefChildrenVisibility} from 'sentry/utils/useRefChildrenVisibility';

interface CarouselProps {
  children?: React.ReactNode;
}

const VISIBLE_RATIO = 0.8;

export function Carousel({children}: CarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {visibility, childrenEls} = useRefChildrenVisibility({
    children,
    scrollContainerRef,
    visibleRatio: VISIBLE_RATIO,
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
    <Container margin="2xs" position="relative">
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
    </Container>
  );
}

const CarouselItems = styled('div')`
  display: flex;
  overflow-x: scroll;
  scroll-behavior: smooth;
  /* We provide some margin to make room for the scroll bar. It is applied on
   * the top and bottom for consistency.
   */
  padding: ${p => p.theme.space.lg} 0;
`;

const StyledArrowButton = styled(Button)<{direction: string}>`
  position: absolute;
  ${p => (p.direction === 'left' ? 'left: 0;' : 'right: 0;')}
  top: 0;
  bottom: 0;
  height: 36px;
  width: 36px;
  border-radius: 50%;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  padding: 0;
  margin: auto;
  background-color: ${p => p.theme.tokens.background.primary};
`;
