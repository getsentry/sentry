import type {ComponentType} from 'react';
import {useContext, useEffect, useId} from 'react';

import {LLMNodeContext, useLLMContextRegistry} from './llmContext';
import type {LLMContextNodeType} from './llmContextTypes';

/**
 * `display: contents` drops this element from the box tree entirely, so it
 * never affects layout (flex/grid siblings, etc.) — the wrapped component's
 * own DOM output behaves exactly as if this element weren't there. It still
 * exists as a real DOM node with a queryable attribute, which is what lets
 * Seer XRay Mode find "the node's DOM position" without every registered
 * component threading a ref through.
 */
const DOM_ANCHOR_STYLE = {display: 'contents'} as const;

/**
 * HOC that registers a component as a named node in the LLM context tree.
 *
 * On mount, a new node of the given `nodeType` is created in the tree,
 * nested under the nearest parent node (from `LLMNodeContext`).
 * On unmount, the node and all its descendants are removed.
 *
 * The wrapped component receives all its original props unchanged.
 * To push structured data into this component's node, call
 * `useLLMContext({ key: value })` anywhere inside the wrapped component.
 *
 * Usage:
 *   const ContextAwareDashboard = registerLLMContext('dashboard', Dashboard);
 *   const ContextAwareWidget = registerLLMContext('widget', Widget);
 *
 *   // Widget rendered inside Dashboard will nest correctly:
 *   // { nodeType: 'dashboard', children: [{ nodeType: 'widget', ... }] }
 */
export function registerLLMContext<P>(
  nodeType: LLMContextNodeType,
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  function LLMContextWrapper(props: P) {
    const ctx = useLLMContextRegistry();

    // Read the nearest parent's nodeId from LLMNodeContext.
    // undefined = no parent (this node will be at root level).
    const parentNodeId = useContext(LLMNodeContext);

    // React's useId generates a stable, unique ID for this component instance.
    const ownNodeId = useId();

    useEffect(() => {
      ctx.registerNode(ownNodeId, nodeType, parentNodeId);
      return () => {
        ctx.unregisterNode(ownNodeId);
      };
      // parentNodeId in deps: if the parent context changes (e.g. parent
      // component re-mounts), re-register under the new parent.
    }, [ctx, ownNodeId, parentNodeId]);

    return (
      // Provide ownNodeId downward so child registerLLMContext wrappers
      // and useLLMContext(data) calls read this as their context anchor.
      <LLMNodeContext.Provider value={ownNodeId}>
        <div
          data-seer-xray-node-id={ownNodeId}
          data-seer-xray-node-type={nodeType}
          style={DOM_ANCHOR_STYLE}
        >
          {/* TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261 */}
          <WrappedComponent {...(props as any)} />
        </div>
      </LLMNodeContext.Provider>
    );
  }

  LLMContextWrapper.displayName = `registerLLMContext(${nodeType}, ${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return LLMContextWrapper;
}
