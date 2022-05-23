import {useCallback, useEffect, useReducer, useRef, useState} from 'react';

import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

import {VirtualizedTree} from './VirtualizedTree';
import {VirtualizedTreeNode} from './VirtualizedTreeNode';
import {VirtualizedTreeStateReducer} from './virtualizedTreeState';

function isInsideViewPort(
  view: {bottom: number; top: number},
  element: {bottom: number; top: number}
) {
  return element.top >= view.top && element.bottom <= view.bottom;
}

export interface TreeLike {
  children: TreeLike[];
}

interface UseVirtualizedListProps<T extends TreeLike> {
  roots: T[];
  overscroll?: number;
}

export function useVirtualizedTree<T extends TreeLike>(
  props: UseVirtualizedListProps<T>
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [tree, setTree] = useState(VirtualizedTree.fromRoots(props.roots));

  useEffectAfterFirstRender(() => {
    setTree(VirtualizedTree.fromRoots(props.roots));
  }, [props.roots]);

  const [state, dispatch] = useReducer(VirtualizedTreeStateReducer, {
    roots: props.roots,
    overscroll: props.overscroll ?? 0,
    scrollTop: 0,
    scrollHeight: containerRef.current?.getBoundingClientRect()?.height ?? 0,
  });

  const handleScroll = useCallback(element => {
    dispatch({type: 'set scroll top', payload: element.target.scrollTop});
  }, []);

  const handleExpandTreeNode = useCallback(
    (node: VirtualizedTreeNode<T>, opts?: {expandChildren: boolean}) => {
      tree.expandNode(node, !node.expanded, opts);
      setTree(new VirtualizedTree(tree.roots, tree.flattened));
    },
    [tree]
  );

  const handleSortingChange = useCallback(
    (sortFn: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number) => {
      tree.sort(sortFn);
      setTree(new VirtualizedTree(tree.roots, tree.flattened));
    },
    [tree]
  );

  // Register scroll listener
  useEffect(() => {
    const ref = containerRef.current;
    if (!ref) {
      return undefined;
    }

    ref.addEventListener('scroll', handleScroll);

    return () => {
      ref.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const viewport = {
    top: state.scrollTop - state.overscroll * 20,
    bottom: state.scrollTop + state.scrollHeight + state.overscroll * 20,
  };

  const items: VirtualizedTreeNode<T>[] = [];

  for (let i = 0; i < tree.flattened.length; i++) {
    const top = i * 20;
    const bottom = top + 20;

    if (isInsideViewPort(viewport, {top, bottom})) {
      items.push(tree.flattened[i]);
    }
  }

  return {
    tree,
    handleExpandTreeNode,
    handleSortingChange,
    items,
    scrollTop: state.scrollTop,
    height: tree.flattened.length * 20,
    containerRef,
  };
}
