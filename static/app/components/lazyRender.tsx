import {useCallback, useRef, useState} from 'react';

function maybeCleanupObserver(
  observerRef: React.MutableRefObject<IntersectionObserver | null>
) {
  if (!observerRef.current) {
    return;
  }

  observerRef.current.disconnect();
  observerRef.current = null;
}

function supportsIntersectionObserver(): boolean {
  return 'IntersectionObserver' in window;
}

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: '0px',
  threshold: 0,
};

interface LazyRenderProps {
  children: React.ReactNode;
  containerHeight?: number;
  observerOptions?: Partial<IntersectionObserverInit>;
}

/**
 * A component that renders its children when it becomes visible in the viewport.
 * If the browser doesn't support IntersectionObserver, the children are rendered immediately.
 *
 * @param props
 * @param props.children
 */
export function LazyRender(props: LazyRenderProps) {
  // If the browser doesn't support IntersectionObserver, render the children immediately.
  const [visible, setVisible] = useState<boolean>(!supportsIntersectionObserver());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const onRefNode = useCallback(
    (node: HTMLDivElement | null) => {
      // If element is already visible or ref was called with null element, cleanup
      // the observer if it is present and bailout early.
      if (!node || visible) {
        maybeCleanupObserver(observerRef);
        return;
      }

      if (typeof props.containerHeight === 'number') {
        node.style.height = `${props.containerHeight}px`;
      }

      const observerOptions: IntersectionObserverInit = {
        ...DEFAULT_OPTIONS,
        ...(props.observerOptions ?? {}),
      };

      const intersectionObserverCallback: IntersectionObserverCallback = entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            maybeCleanupObserver(observerRef);
          }
        }
      };

      observerRef.current = new IntersectionObserver(
        intersectionObserverCallback,
        observerOptions
      );
      observerRef.current.observe(node);
    },
    [visible, props.observerOptions, props.containerHeight]
  );

  return <div ref={onRefNode}>{visible ? props.children : null}</div>;
}
