import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';
import {ArrowProps} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  children?: React.ReactNode;
};

function Carousel({children}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [anchorRefs, setAnchorRefs] = useState<HTMLElement[]>([]);
  const [childrenRefs, setChildrenRefs] = useState<HTMLElement[]>([]);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  useEffect(() => {
    if (!ref.current) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.target.id === anchorRefs[0].id) {
            setIsAtStart(e.isIntersecting);
          } else if (e.target.id === anchorRefs[1].id) {
            setIsAtEnd(e.isIntersecting);
          }
        });
      },
      {root: ref.current, threshold: [1]}
    );

    if (anchorRefs) {
      anchorRefs.map(anchor => observer.observe(anchor));
    }

    return () => observer.disconnect();
  }, [anchorRefs]);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    setChildrenRefs(Array.from(ref.current.children) as HTMLElement[]);

    const anchors = [
      ref.current.children[0],
      ref.current.children[ref.current.children.length - 1],
    ] as HTMLElement[];
    setAnchorRefs(anchors);
  }, [children]);

  const handleScroll = (direction: string) => {
    if (!ref.current) {
      return;
    }

    const scrollLeft = ref.current.scrollLeft;

    if (direction === 'left') {
      // scroll to the last child to the left of the left side of the container
      const elements = childrenRefs.filter(child => child.offsetLeft < scrollLeft);
      ref.current.scrollTo(elements[elements.length - 1].offsetLeft, 0);
    } else if (direction === 'right') {
      // scroll to the first child to the right of the left side of the container
      const elements = childrenRefs.filter(child => child.offsetLeft > scrollLeft);
      ref.current.scrollTo(elements[0].offsetLeft, 0);
    }
  };

  return (
    <CarouselContainer>
      <CarouselItems ref={ref}>
        <Anchor id="left-anchor" />
        {children}
        <Anchor id="right-anchor" />
      </CarouselItems>
      {!isAtStart && (
        <ScrollButton onClick={() => handleScroll('left')} direction="left" />
      )}
      {!isAtEnd && (
        <ScrollButton onClick={() => handleScroll('right')} direction="right" />
      )}
    </CarouselContainer>
  );
}

const CarouselContainer = styled('div')`
  position: relative;
  padding-bottom: ${space(0.5)};
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
    background: ${p => p.theme.gray300};
    border-radius: 8px;
  }
`;

const Anchor = styled('div')``;

type ScrollButtonProps = {
  direction: ArrowProps['direction'];
  onClick: () => void;
};

function ScrollButton({onClick, direction = 'left'}: ScrollButtonProps) {
  return (
    <StyledArrowButton
      onClick={onClick}
      direction={direction}
      aria-label={t('Scroll %s', direction)}
      icon={<IconArrow size="sm" direction={direction} />}
    />
  );
}

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
