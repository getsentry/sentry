import {useLayoutEffect, useRef, useState} from 'react';

import {ROOT_ELEMENT} from 'sentry/constants';

const INITIAL_LOADER_SELECTOR = '.splash-loader';

interface InitialLoaderSnapshot {
  animationStates: Array<{
    currentTime: number | null;
    playbackRate: number;
    startTime: number | null;
  }>;
  html: string;
}

function getNumericTime(time: CSSNumberish | null): number | null {
  return typeof time === 'number' ? time : null;
}

interface InitialLoadingIndicatorProps {
  fallback?: React.ReactNode;
}

/**
 * Snapshots the splash loader rendered by Django before React's first commit
 * replaces the contents of its root. Each rendered copy keeps the splash
 * class, allowing bootstrap loading boundaries to hand off the same trusted
 * markup without copying arbitrary application content. Dev-ui includes both
 * seasonal loader variants, so only its visible variant is eligible. Once the
 * splash loader leaves the root, later lazy loads use their normal fallback.
 * Animation timing is captured with the markup so each handoff can continue
 * on the original document timeline.
 */
export function InitialLoadingIndicator({fallback = null}: InitialLoadingIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialLoaderSnapshot] = useState<InitialLoaderSnapshot | null>(() => {
    const root = document.getElementById(ROOT_ELEMENT);
    const initialLoader = Array.from(
      root?.querySelectorAll<HTMLElement>(INITIAL_LOADER_SELECTOR) ?? []
    ).find(loader => loader.style.display !== 'none');

    if (!initialLoader) {
      return null;
    }

    return {
      animationStates: (initialLoader.getAnimations?.({subtree: true}) ?? []).map(
        animation => ({
          currentTime: getNumericTime(animation.currentTime),
          playbackRate: animation.playbackRate,
          startTime: getNumericTime(animation.startTime),
        })
      ),
      html: initialLoader.outerHTML,
    };
  });

  useLayoutEffect(() => {
    const initialLoader = containerRef.current?.querySelector<HTMLElement>(
      INITIAL_LOADER_SELECTOR
    );
    const animations = initialLoader?.getAnimations?.({subtree: true}) ?? [];

    animations.forEach((animation, index) => {
      const state = initialLoaderSnapshot?.animationStates[index];
      if (!state) {
        return;
      }

      try {
        animation.playbackRate = state.playbackRate;

        if (state.startTime !== null) {
          animation.startTime = state.startTime;
        } else if (state.currentTime !== null) {
          animation.currentTime = state.currentTime;
        }
      } catch {
        // State transfer is best-effort; the cloned CSS animation keeps running.
      }
    });
  }, [initialLoaderSnapshot]);

  if (!initialLoaderSnapshot) {
    return fallback;
  }

  return (
    <div
      ref={containerRef}
      dangerouslySetInnerHTML={{__html: initialLoaderSnapshot.html}}
    />
  );
}
