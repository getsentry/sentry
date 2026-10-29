import {createContext, useContext, useEffect, useState, type RefObject} from 'react';

// Start fetching a little before a widget scrolls into view so it is ready by the
// time the user reaches it.
const WIDGET_VIEWPORT_ROOT_MARGIN = '200px 0px';

// Defaults to true so widgets rendered outside a dashboard grid (widget builder,
// widget viewer modal, etc.) always fetch.
const WidgetInViewportContext = createContext(true);

export const WidgetInViewportProvider = WidgetInViewportContext.Provider;

export function useIsWidgetInViewport(): boolean {
  return useContext(WidgetInViewportContext);
}

function supportsIntersectionObserver(): boolean {
  return 'IntersectionObserver' in window;
}

/**
 * Tracks whether a dashboard widget is near the viewport. Unlike `LazyRender`,
 * this keeps observing after the first intersection so widget queries can be
 * paused while the widget is offscreen.
 */
export function useWidgetViewportVisibility(
  ref: RefObject<Element | null>,
  {disabled = false}: {disabled?: boolean} = {}
): {hasBeenInViewport: boolean; isInViewport: boolean} {
  const alwaysVisible = disabled || !supportsIntersectionObserver();
  const [isInViewport, setIsInViewport] = useState(false);
  const [hasBeenInViewport, setHasBeenInViewport] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (alwaysVisible || !node) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries.at(-1);
        if (!entry) {
          return;
        }
        setIsInViewport(entry.isIntersecting);
        if (entry.isIntersecting) {
          setHasBeenInViewport(true);
        }
      },
      {rootMargin: WIDGET_VIEWPORT_ROOT_MARGIN}
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, alwaysVisible]);

  return {
    isInViewport: alwaysVisible || isInViewport,
    hasBeenInViewport: alwaysVisible || hasBeenInViewport,
  };
}
