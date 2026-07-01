import {useCallback, useLayoutEffect, useRef, useState} from 'react';
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
  const containerWidthRef = useRef(0);

  const showSlidingText = isHovered && isTruncated;

  const setAnimationPlaybackRate = (playbackRate: number) => {
    const animation = animationRef.current;
    if (!animation) {
      return;
    }

    if (animation.playbackRate !== playbackRate) {
      animation.updatePlaybackRate(playbackRate);
    }

    // Once an animation reaches an endpoint, changing playbackRate alone can
    // leave it in a finished state. Explicitly resume for directional movement.
    if (playbackRate !== 0 && animation.playState === 'finished') {
      animation.play();
    }
  };

  const rebuildAnimation = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!showSlidingText || !container || !content) {
      animationRef.current?.cancel();
      animationRef.current = null;
      return;
    }

    animationRef.current?.cancel();
    scrollWidthRef.current = content.scrollWidth;
    containerWidthRef.current = container.clientWidth;

    const maxTranslate = content.scrollWidth - container.clientWidth;
    if (maxTranslate <= 0) {
      animationRef.current = null;
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
    // Keep text stationary until mouse position drives the playback direction.
    animation.updatePlaybackRate(0);
    animationRef.current = animation;
  }, [leftTrim, showSlidingText, speed]);

  useLayoutEffect(() => {
    rebuildAnimation();
  }, [rebuildAnimation, value]);

  useLayoutEffect(() => {
    if (!showSlidingText || typeof ResizeObserver === 'undefined') {
      return;
    }

    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (
        scrollWidthRef.current !== content.scrollWidth ||
        containerWidthRef.current !== container.clientWidth
      ) {
        rebuildAnimation();
      }
    });

    resizeObserver.observe(container);
    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  }, [rebuildAnimation, showSlidingText]);

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

    if (
      scrollWidthRef.current !== content.scrollWidth ||
      containerWidthRef.current !== container.clientWidth
    ) {
      rebuildAnimation();
    }

    const mouseX = event.clientX - rect.left;
    const effectiveEdgeWidth = Math.min(edgeWidth, rect.width / 2);
    const playbackDirectionMultiplier = leftTrim ? -1 : 1;

    // left
    if (animationRef.current) {
      if (mouseX <= effectiveEdgeWidth) {
        setAnimationPlaybackRate(-1 * playbackDirectionMultiplier);
      } else if (rect.width - mouseX <= effectiveEdgeWidth) {
        setAnimationPlaybackRate(playbackDirectionMultiplier);
      } else {
        setAnimationPlaybackRate(0);
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
