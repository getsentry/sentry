import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

type StoredNode<T> = {
  dataRef: React.MutableRefObject<T>;
  key: string;
  parent: string | null;
};

export type CollectionTreeNode<T> = {
  children: Array<CollectionTreeNode<T>>;
  key: string;
  parent: string | null;
} & T;

interface CollectionStore<T> {
  getSnapshot: () => Map<string, StoredNode<T>>;
  register: (node: StoredNode<T>) => void;
  subscribe: (callback: () => void) => () => void;
  tree: (rootKey?: string | null) => Array<CollectionTreeNode<T>>;
  unregister: (key: string) => void;
}

interface CollectionInstance<T> {
  Context: React.Context<string | null>;
  Provider: (props: {children: React.ReactNode}) => React.ReactElement;
  useRegisterNode: (data: T) => string;
  useStore: () => CollectionStore<T>;
}

export function makeCollection<T>(): CollectionInstance<T> {
  const StoreContext = createContext<CollectionStore<T> | null>(null);

  const Context = createContext<string | null>(null);

  function Provider({children}: {children: React.ReactNode}) {
    const nodes = useRef(new Map<string, StoredNode<T>>());

    // Secondary index: parent key → ordered Set of child keys.
    // Insertion order = JSX order (guaranteed by React's depth-first left-to-right
    // effect ordering: siblings register before their next sibling's subtree fires).
    const childIndex = useRef(new Map<string | null, Set<string>>());

    // Snapshot ref holds a new Map instance on every structural change so that
    // useSyncExternalStore can detect updates via reference inequality.
    const snapshot = useRef(nodes.current);

    // Registered listener callbacks from useSyncExternalStore subscribers.
    const listeners = useRef(new Set<() => void>());

    const store = useMemo<CollectionStore<T>>(
      () => ({
        subscribe(callback) {
          listeners.current.add(callback);
          return () => listeners.current.delete(callback);
        },

        getSnapshot() {
          return snapshot.current;
        },

        register(node) {
          const existing = nodes.current.get(node.key);
          if (existing) {
            if (existing.parent === node.parent) {
              // Same parent: no structural change, data is kept current via dataRef.
              return;
            }
            // Different parent: remove from the old parent's child set before
            // re-inserting under the new one, so the key never appears twice.
            childIndex.current.get(existing.parent)?.delete(node.key);
          }
          nodes.current.set(node.key, node);
          const siblings = childIndex.current.get(node.parent) ?? new Set<string>();
          siblings.add(node.key);
          childIndex.current.set(node.parent, siblings);
          snapshot.current = new Map(nodes.current);
          listeners.current.forEach(l => l());
        },

        unregister(key) {
          const node = nodes.current.get(key);
          if (!node) return;
          nodes.current.delete(key);
          childIndex.current.get(node.parent)?.delete(key);
          childIndex.current.delete(key);
          snapshot.current = new Map(nodes.current);
          listeners.current.forEach(l => l());
        },

        tree(rootKey = null): Array<CollectionTreeNode<T>> {
          const childKeys = childIndex.current.get(rootKey) ?? new Set<string>();
          return [...childKeys].map(key => {
            const node = nodes.current.get(key)!;
            return {
              key: node.key,
              parent: node.parent,
              children: this.tree(key),
              ...node.dataRef.current,
            };
          });
        },
      }),
      []
    );

    return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
  }

  function useStore(): CollectionStore<T> {
    const store = useContext(StoreContext);
    if (!store) {
      throw new Error('useStore must be called inside the matching Collection Provider');
    }
    // Subscribe to structural changes via useSyncExternalStore. Each registration
    // or unregistration produces a new snapshot Map instance, so this causes a
    // re-render whenever the node tree changes.
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    // Return a new wrapper object on every snapshot change so that consumers
    // using the return value as a useMemo / useCallback dependency get correct
    // cache invalidation whenever the node tree changes.
    return useMemo(
      () => ({
        subscribe: store.subscribe,
        getSnapshot: store.getSnapshot,
        register: store.register,
        unregister: store.unregister,
        // bind so that this.tree() works correctly in recursive calls
        tree: store.tree.bind(store),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [snapshot, store]
    );
  }

  function useRegisterNode(data: T): string {
    // Read the stable store from context directly — NOT via useStore() — so
    // that structural node changes (which produce a new useStore() reference)
    // do not invalidate the layout-effect deps and trigger re-registration loops.
    const store = useContext(StoreContext);
    if (!store) {
      throw new Error(
        'useRegisterNode must be called inside the matching Collection Provider'
      );
    }
    const parentKey = useContext(Context);

    const key = useId();
    // Store data in a ref so tree() always reflects the latest value without
    // needing to re-register when data changes. Structural changes (parentKey)
    // still cause a full re-registration via the effect deps.
    const dataRef = useRef(data);
    dataRef.current = data;

    useLayoutEffect(() => {
      store.register({key, parent: parentKey, dataRef});
      return () => {
        store.unregister(key);
      };
    }, [key, parentKey, store]);

    return key;
  }

  return {Provider, Context, useStore, useRegisterNode};
}
