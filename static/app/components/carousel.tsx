import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';

type Props = {
  children?: React.ReactNode;
};

function Carousel({children}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isAtStart, setIsAtStart] = useState<boolean>(true);
  const [isAtEnd, setIsAtEnd] = useState<boolean>(false);
  const [showArrows, setShowArrows] = useState<boolean>(true);

  const setStartAndEnd = (scrollLeft: number, totalScrollDist: number) => {
    // scrollLeft: the amount scrolled horizontally.
    // start at 0 and end at totalScrollDist

    // totalScrollDist = scrollWidth - clientWidth
    // scrollWidth: total element width including overflow
    // clientWidth: width of the element excluding overflow
    if (scrollLeft <= 0) {
      setIsAtStart(true);
      setIsAtEnd(false);
    } else if (scrollLeft >= totalScrollDist) {
      setIsAtStart(false);
      setIsAtEnd(true);
    } else {
      setIsAtStart(false);
      setIsAtEnd(false);
    }
  };

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const contentWidth = ref.current.scrollWidth - ref.current.clientWidth;
    if (contentWidth === 0) {
      setShowArrows(false);
    }

    const scrollLeft = ref.current.scrollLeft;
    setStartAndEnd(scrollLeft, contentWidth);
  }, [ref]);

  const handleScroll = (direction: string) => {
    requestAnimationFrame(() => {
      if (!ref.current) {
        return;
      }

      const scrollLeft = ref.current.scrollLeft;
      const itemWidth = parseInt(getComputedStyle(ref.current.children[0]).width, 10);

      let scrollDist = 0;
      if (direction === 'left') {
        scrollDist = scrollLeft - itemWidth;
      } else if (direction === 'right') {
        scrollDist = scrollLeft + itemWidth;
      }
      ref.current.scrollLeft = scrollDist;
    });
  };

  const setArrows = () => {
    requestAnimationFrame(() => {
      if (!ref.current) {
        return;
      }

      const scrollLeft = ref.current.scrollLeft;
      const totalScrollDist = ref.current.scrollWidth - ref.current.clientWidth;

      setStartAndEnd(scrollLeft, totalScrollDist);
    });
  };

  return (
    <CarouselContainer>
      <CarouselItems ref={ref} onScroll={setArrows}>
        {children}
      </CarouselItems>
      {showArrows && !isAtStart && (
        <CircledArrow onClick={() => handleScroll('left')} direction="left" />
      )}
      {showArrows && !isAtEnd && (
        <CircledArrow onClick={() => handleScroll('right')} direction="right" />
      )}
    </CarouselContainer>
  );
}

const CarouselContainer = styled('div')`
  position: relative;
`;

const CarouselItems = styled('div')`
  display: flex;
  overflow-x: scroll;
  scroll-behavior: smooth;
  &::-webkit-scrollbar {
    background-color: transparent;
    height: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${p => p.theme.gray400};
    border-radius: 8px;
  }
`;

type ArrowProps = {
  direction: 'up' | 'down' | 'left' | 'right';
  onClick: () => void;
};

function CircledArrow({onClick, direction}: ArrowProps) {
  return (
    <StyledArrowButton
      onClick={onClick}
      direction={direction}
      data-test-id={`arrow-${direction}`}
    >
      <IconArrow color="black" size="sm" direction={direction} />
    </StyledArrowButton>
  );
}

const StyledArrowButton = styled(Button)<{direction: string}>`
  position: absolute;
  ${p => (p.direction === 'left' ? `left: 0;` : `right: 0;`)}
  top: 0;
  bottom: 0;
  height: 36px;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 66px;
  border: 1px solid ${p => p.theme.gray200};
  padding: 0;
  margin: auto;
  background-color: white;
`;

export default Carousel;
