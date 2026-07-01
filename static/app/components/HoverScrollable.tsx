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
  speed = 0.15,
  edgeWidth = 40,
}: HoverScrollableProps) {
  const [isHovered, setIsHovered] = useState(false);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const scrollWidthRef = useRef(0);

  const showSlidingText = isHovered && isTruncated;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!showSlidingText || !container || !content) {
      return;
    }
    animationRef.current?.cancel();
    scrollWidthRef.current = content.scrollWidth;

    const maxTranslate = content.scrollWidth - container.clientWidth;
    if (maxTranslate <= 0) {
      return;
    }

    const duration = maxTranslate / speed;
    const animation = content.animate(
      [{transform: 'translateX(0)'}, {transform: `translateX(${-maxTranslate}px)`}],
      {
        duration,
        easing: 'linear',
        fill: 'both',
      }
    );

    animation.currentTime = leftTrim ? duration : 0;
    if (leftTrim) {
      animation.reverse();
    }
    animationRef.current = animation;
  }, [leftTrim, showSlidingText, speed, value]);

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

    if (scrollWidthRef.current !== content.scrollWidth) {
      scrollWidthRef.current = content.scrollWidth;
      animationRef.current?.updatePlaybackRate(0);
    }

    const mouseX = event.clientX - rect.left;
    const effectiveEdgeWidth = Math.min(edgeWidth, rect.width / 2);

    // left
    if (animationRef.current) {
      if (mouseX <= effectiveEdgeWidth) {
        if (animationRef.current.playbackRate !== -1) {
          animationRef.current.updatePlaybackRate(-1);
        }
      } else if (rect.width - mouseX <= effectiveEdgeWidth) {
        if (animationRef.current.playbackRate !== 1) {
          animationRef.current.updatePlaybackRate(1);
        }
      } else {
        if (animationRef.current.playbackRate !== 0) {
          animationRef.current.updatePlaybackRate(0);
        }
      }
    }
  };

  const handleMouseLeave = () => {
    if (animationRef.current) {
      animationRef.current.cancel();
    }

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

const SlidingContainer = styled('span')`
  display: inline-block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  vertical-align: bottom;
  cursor: text;
  box-sizing: border-box;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.tokens.focus.onVibrant};
  border-radius: ${p => p.theme.space.xs};
`;

const SlidingText = styled('span')`
  display: inline-block;
  white-space: nowrap;
`;
