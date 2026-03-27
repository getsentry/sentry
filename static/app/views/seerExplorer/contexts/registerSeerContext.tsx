import type {ComponentType} from 'react';
import {useContext, useEffect, useMemo} from 'react';

import {uniqueId} from 'sentry/utils/guid';

import {SeerNodeContext, useSeerContextRegistry} from './seerContext';

/**
 * HOC that registers a component as a named node in the Seer context tree.
 *
 * On mount, a new node of the given `nodeType` is created in the tree,
 * nested under the nearest parent node (from `SeerNodeContext`).
 * On unmount, the node and all its descendants are removed.
 *
 * The wrapped component receives all its original props unchanged.
 * To push structured data into this component's node, call
 * `useSeerContext({ key: value })` anywhere inside the wrapped component.
 *
 * Usage:
 *   const ContextAwareDashboard = registerSeerContext('dashboard', Dashboard);
 *   const ContextAwareWidget = registerSeerContext('widget', Widget);
 *
 *   // Widget rendered inside Dashboard will nest correctly:
 *   // { nodeType: 'dashboard', children: [{ nodeType: 'widget', ... }] }
 */
export function registerSeerContext<P extends Record<string, unknown>>(
  nodeType: string,
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  function SeerContextWrapper(props: P) {
    const ctx = useSeerContextRegistry();

    // Read the nearest parent's nodeId from SeerNodeContext.
    // undefined = no parent (this node will be at root level).
    const parentNodeId = useContext(SeerNodeContext);

    // Generate a stable nodeId synchronously during render (useMemo with []).
    // This is available to children BEFORE any effects fire, which means
    // children that are also registerSeerContext-wrapped will read the correct
    // parentNodeId from context during their own render — no cascade needed.
    const ownNodeId = useMemo(() => uniqueId(), []);

    useEffect(() => {
      if (!ctx) {
        return undefined;
      }
      ctx.registerNode(ownNodeId, nodeType, parentNodeId);
      return () => {
        ctx.unregisterNode(ownNodeId);
      };
      // parentNodeId in deps: if the parent context changes (e.g. parent
      // component re-mounts), re-register under the new parent.
    }, [ctx, ownNodeId, parentNodeId]);

    return (
      // Provide ownNodeId downward so child registerSeerContext wrappers
      // and useSeerContext(data) calls read this as their context anchor.
      <SeerNodeContext.Provider value={ownNodeId}>
        {/* TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261 */}
        <WrappedComponent {...(props as P as any)} />
      </SeerNodeContext.Provider>
    );
  }

  SeerContextWrapper.displayName = `registerSeerContext(${nodeType}, ${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return SeerContextWrapper;
}
