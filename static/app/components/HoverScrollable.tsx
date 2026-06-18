import {useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {OverflowText} from 'sentry/components/OverflowText';

interface HoverScrollableProps {
  value: string;
  className?: string;
  edgeWidth?: number;
  leftTrim?: boolean;
  speed?: number;
}

export function HoverScrollable({
  value,
  className,
  leftTrim = false,
  speed = 0.1,
  edgeWidth = 40,
}: HoverScrollableProps) {
  const [isHovered, setIsHovered] = useState(false);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const direction = useRef<boolean | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const targetRef = useRef(0);

  const showSlidingText = isHovered && isTruncated;

  useLayoutEffect(() => {
    // When the hover container appears, instantly snap it to the rightmost edge
    if (showSlidingText && containerRef.current && contentRef.current && leftTrim) {
      const container = containerRef.current;
      const content = contentRef.current;
      const maxTranslate = content.scrollWidth - container.clientWidth;

      if (maxTranslate > 0) {
        content.style.transform = `translateX(${-maxTranslate}px)`;
      }
    }
  }, [leftTrim, showSlidingText]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseHover = (event: React.MouseEvent<HTMLSpanElement>) => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const maxTranslate = content.scrollWidth - container.clientWidth;

    if (maxTranslate <= 0) {
      return;
    }

    const mouseX = event.clientX - rect.left;

    let target: number | null = null;

    // left
    if (mouseX <= edgeWidth) {
      target = 0;
      if (direction.current === false) {
        // already moving left, no need to restart animation
        return;
      }
      direction.current = false;
    }

    // right
    if (rect.width - mouseX <= edgeWidth) {
      target = -maxTranslate;
      if (direction.current === true) {
        // already moving right, no need to restart animation
        return;
      }
      direction.current = true;
    }

    // middle
    if (target === null) {
      if (direction.current !== null) {
        animationRef.current?.commitStyles();
        animationRef.current?.cancel();
        animationRef.current = null;
        direction.current = null;
      }
      return;
    }

    // a new target
    animationRef.current?.play();

    targetRef.current = target;

    const currentX = getCurrentTranslateX(content);
    const distance = Math.abs(target - currentX);
    const duration = distance / speed;

    animationRef.current?.cancel();

    animationRef.current = content.animate(
      [
        {
          transform: getComputedStyle(content).transform,
        },
        {
          transform: `translateX(${target}px)`,
        },
      ],
      {
        duration,
        easing: 'linear',
        fill: 'forwards',
      }
    );
  };

  const handleMouseLeave = () => {
    animationRef.current?.cancel();
    animationRef.current = null;
    direction.current = null;

    setIsHovered(false);
  };

  return (
    <Container
      ref={wrapperRef}
      as="span"
      className={className}
      display="inline-block"
      maxWidth="100%"
      width="100%"
      overflow="hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showSlidingText ? (
        <SlidingContainer ref={containerRef} onMouseMove={handleMouseHover}>
          <SlidingText ref={contentRef}>{value}</SlidingText>
        </SlidingContainer>
      ) : (
        <OverflowText value={value} leftTrim={leftTrim} onTrimChange={setIsTruncated} />
      )}
    </Container>
  );
}

function getCurrentTranslateX(element: HTMLElement) {
  const transform = window.getComputedStyle(element).transform;

  if (transform === 'none') {
    return 0;
  }

  return new DOMMatrixReadOnly(transform).m41;
}

const SlidingContainer = styled('span')`
  display: inline-block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  vertical-align: bottom;
`;

const SlidingText = styled('span')`
  display: inline-block;
  white-space: nowrap;
`;
