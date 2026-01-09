import {useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

export function FlyingLinesEffect({targetElement}: {targetElement: HTMLElement | null}) {
  const [position, setPosition] = useState({left: 0, top: 0});
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 16;

  useLayoutEffect(() => {
    if (!targetElement) {
      return undefined;
    }

    function getScrollParents(element: HTMLElement): Element[] {
      const scrollParents: Element[] = [];
      let currentElement = element.parentElement;

      while (currentElement) {
        const overflow = window.getComputedStyle(currentElement).overflow;
        if (overflow.includes('scroll') || overflow.includes('auto')) {
          scrollParents.push(currentElement);
        }
        currentElement = currentElement.parentElement;
      }

      return scrollParents;
    }

    const updatePosition = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) {
        rafRef.current = requestAnimationFrame(updatePosition);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const left = rect.left + rect.width / 2;
      const top = rect.top + rect.height / 2;
      setPosition({left, top});
      lastUpdateRef.current = now;
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    // Create portal container if it doesn't exist
    if (!portalContainerRef.current) {
      portalContainerRef.current = document.createElement('div');
      document.body.appendChild(portalContainerRef.current);
    }

    rafRef.current = requestAnimationFrame(updatePosition);

    const scrollElements = [window, ...getScrollParents(targetElement)];
    scrollElements.forEach(element => {
      element.addEventListener('scroll', updatePosition, {passive: true});
    });

    window.addEventListener('resize', updatePosition, {passive: true});

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(targetElement);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      scrollElements.forEach(element => {
        element.removeEventListener('scroll', updatePosition);
      });
      window.removeEventListener('resize', updatePosition);
      resizeObserver.disconnect();

      // Clean up portal container
      if (portalContainerRef.current) {
        document.body.removeChild(portalContainerRef.current);
        portalContainerRef.current = null;
      }
    };
  }, [targetElement]);

  if (!targetElement || !portalContainerRef.current) {
    return null;
  }

  return createPortal(
    <FlyingLinesContainer style={{left: position.left, top: position.top}}>
      <AdditionalLine delay={-0.6} variant="leftColored" />
      <AdditionalLine delay={-0.8} rotation={45} variant="rightColored" />
      <AdditionalLine delay={-1.0} rotation={-30} variant="leftColored" />
    </FlyingLinesContainer>,
    portalContainerRef.current
  );
}

const flyingLines = keyframes`
  0% {
    transform: scale(1.5);
    opacity: 0;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    transform: scale(0);
    opacity: 0;
  }
`;

const AdditionalLine = styled('div')<{
  delay: number;
  rotation?: number;
  variant?: 'leftColored' | 'rightColored';
}>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: ${p => p.theme.tokens.content.secondary};
  border-bottom-color: ${p => p.theme.tokens.content.secondary};
  border-left-color: ${p =>
    p.variant === 'leftColored' ? p.theme.tokens.content.secondary : 'transparent'};
  border-right-color: ${p =>
    p.variant === 'rightColored' ? p.theme.tokens.content.secondary : 'transparent'};
  animation: ${flyingLines} 1s linear infinite;
  animation-delay: ${p => p.delay}s;
  transform: ${p => (p.rotation ? `rotate(${p.rotation}deg)` : 'none')};
`;

const FlyingLinesContainer = styled('div')`
  position: fixed;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%);
  z-index: ${p => p.theme.zIndex.tooltip};
  opacity: 0.5;
  pointer-events: none;

  &:before,
  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: ${p => p.theme.tokens.content.secondary};
    border-bottom-color: ${p => p.theme.tokens.content.secondary};
    animation: ${flyingLines} 1s linear infinite;
  }

  &:before {
    border-left-color: ${p => p.theme.tokens.content.secondary};
    border-right-color: transparent;
    animation-delay: -0.4s;
  }

  &:after {
    border-left-color: transparent;
    border-right-color: ${p => p.theme.tokens.content.secondary};
    animation-delay: -0.2s;
  }
`;
