import type {ComponentType} from 'react';
import {useEffect, useRef} from 'react';

import {usePageContext, usePageContextProvider} from './pageContext';

interface RegisterPageContextOptions<P> {
  extract?: (props: P) => Record<string, unknown>;
}

/**
 * HOC that registers a component as a node in the page context tree.
 *
 * When the wrapped component mounts, a new node is created in the tree.
 * When it unmounts, the node is removed. If an `extract` function is
 * provided, it pulls data from the component's props on every render
 * and pushes it into the node.
 *
 * The wrapped component receives all its original props unchanged —
 * it doesn't know this HOC exists.
 *
 * Usage (Stage 4):
 *   const ContextAwareWidget = registerPageContext('widget', SortableWidget, {
 *     extract: (props) => ({ title: props.widget.title })
 *   })
 */
export function registerPageContext<P extends Record<string, unknown>>(
  nodeType: string,
  WrappedComponent: ComponentType<P>,
  options?: RegisterPageContextOptions<P>
): ComponentType<P> {
  function PageContextWrapper(props: P) {
    const ctx = usePageContextProvider();
    const nodeIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
      if (!ctx) {
        return undefined;
      }

      const id = ctx.registerNode(nodeType);
      nodeIdRef.current = id;

      return () => {
        ctx.unregisterNode(id);
        nodeIdRef.current = undefined;
      };
    }, [ctx]);

    const extractedData = options?.extract ? options.extract(props) : undefined;
    usePageContext(nodeIdRef.current, extractedData ?? {});

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(props as any)} />;
  }

  PageContextWrapper.displayName = `registerPageContext(${nodeType}, ${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return PageContextWrapper;
}
