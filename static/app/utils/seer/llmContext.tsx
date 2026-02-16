import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';

// ---- Types ----

/**
 * Categorizes what kind of entity an LLM context node represents.
 *
 * This helps the LLM understand the role of each node in the UI hierarchy:
 * - 'page': A top-level page or view (e.g. Issue Details, Discover)
 * - 'filter': A control that filters or scopes data (e.g. environment, project, date range)
 * - 'chart': A data visualization (e.g. time series, bar chart)
 * - 'table': A tabular data display
 * - 'navigation': A navigation element (e.g. tabs, breadcrumbs, sidebar)
 * - 'form': A form or input group
 * - 'panel': A collapsible or togglable panel/section
 * - 'component': A generic interactive component that doesn't fit other categories
 */
export type LLMContextEntity =
  | 'chart'
  | 'component'
  | 'filter'
  | 'form'
  | 'navigation'
  | 'page'
  | 'panel'
  | 'table';

/**
 * Describes an action that an LLM can dispatch against a UI component.
 */
export interface LLMAction {
  /** Human-readable description of what this action does */
  description: string;
  /** JSON-schema describing the expected payload */
  schema: Record<string, unknown>;
  /** Machine-readable action name (e.g. "setEnvironments") */
  type: string;
}

/**
 * Internal flat representation of a registered context node.
 */
interface LLMContextEntry {
  actions: LLMAction[];
  data: Record<string, unknown>;
  description: string;
  entity: LLMContextEntity;
  id: string;
  name: string;
  parentId: string | null;
  ref: HTMLElement | null;
}

/**
 * Tree-shaped node returned by useLLMContextTree().
 */
export interface LLMContextNode extends Omit<LLMContextEntry, 'parentId'> {
  children: LLMContextNode[];
}

// ---- Registry (lives in LLMContextRoot) ----

type Listener = () => void;

/**
 * A mutable registry that stores LLM context entries in a flat Map
 * and exposes a subscribe/getSnapshot API for useSyncExternalStore.
 */
class LLMContextRegistry {
  private entries = new Map<string, LLMContextEntry>();
  private listeners = new Set<Listener>();
  private version = 0;

  // Dispatch handler: contextId + action type -> handler function
  private handlers = new Map<string, Map<string, (payload: unknown) => void>>();

  register(entry: LLMContextEntry) {
    this.entries.set(entry.id, entry);
    this.notify();
  }

  unregister(id: string) {
    this.entries.delete(id);
    this.handlers.delete(id);
    this.notify();
  }

  update(id: string, patch: Partial<Omit<LLMContextEntry, 'id' | 'parentId'>>) {
    const existing = this.entries.get(id);
    if (existing) {
      this.entries.set(id, {...existing, ...patch});
      this.notify();
    }
  }

  registerHandler(
    contextId: string,
    actionType: string,
    handler: (payload: unknown) => void
  ) {
    let contextHandlers = this.handlers.get(contextId);
    if (!contextHandlers) {
      contextHandlers = new Map();
      this.handlers.set(contextId, contextHandlers);
    }
    contextHandlers.set(actionType, handler);
  }

  unregisterHandlers(contextId: string) {
    this.handlers.delete(contextId);
  }

  /**
   * Dispatch an action to a specific context node by name.
   * Returns true if the action was handled.
   */
  dispatch(contextName: string, actionType: string, payload: unknown): boolean {
    for (const [id, entry] of this.entries) {
      if (entry.name === contextName) {
        const contextHandlers = this.handlers.get(id);
        const handler = contextHandlers?.get(actionType);
        if (handler) {
          handler(payload);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Build the tree from the flat map.
   * Nodes with no parent (parentId === null) are roots.
   */
  getTree(): LLMContextNode[] {
    const childrenMap = new Map<string | null, LLMContextEntry[]>();

    for (const entry of this.entries.values()) {
      const siblings = childrenMap.get(entry.parentId) ?? [];
      siblings.push(entry);
      childrenMap.set(entry.parentId, siblings);
    }

    function buildSubtree(parentId: string | null): LLMContextNode[] {
      const children = childrenMap.get(parentId) ?? [];
      return children.map(entry => ({
        actions: entry.actions,
        children: buildSubtree(entry.id),
        data: entry.data,
        description: entry.description,
        entity: entry.entity,
        id: entry.id,
        name: entry.name,
        ref: entry.ref,
      }));
    }

    return buildSubtree(null);
  }

  // ---- useSyncExternalStore API ----

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): number => {
    return this.version;
  };

  private notify() {
    this.version++;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// ---- React Contexts ----

/**
 * Holds the registry instance. Provided once by LLMContextRoot.
 * Stable reference — never causes re-renders in children.
 */
const RegistryContext = createContext<LLMContextRegistry | null>(null);

/**
 * Holds the parent node's ID. Provided by each LLMContext so
 * children can discover their parent and form the tree.
 */
const ParentContext = createContext<string | null>(null);

// ---- Components ----

/**
 * Root provider for the LLM context tree.
 * Place this once near the top of your app (e.g. alongside ExplorerPanelProvider).
 */
export function LLMContextRoot({children}: {children: ReactNode}) {
  const registryRef = useRef<LLMContextRegistry | null>(null);
  if (registryRef.current === null) {
    registryRef.current = new LLMContextRegistry();
  }

  return (
    <RegistryContext.Provider value={registryRef.current}>
      <ParentContext.Provider value={null}>{children}</ParentContext.Provider>
    </RegistryContext.Provider>
  );
}

// ---- Hook API ----

export interface UseLLMContextOptions {
  /** Human-readable description of what this UI region does */
  description: string;
  /** What kind of entity this node represents (page, filter, chart, etc.) */
  entity: LLMContextEntity;
  /** Machine-readable name (used as action target, e.g. "environment-filter") */
  name: string;
  /** Actions the LLM can dispatch against this context */
  actions?: LLMAction[];
  /** Current state snapshot to expose to the LLM */
  data?: Record<string, unknown>;
  /** Action handlers keyed by action type */
  onAction?: Record<string, (payload: any) => void>;
}

export interface UseLLMContextResult {
  /** Attach this ref to the DOM node you want to associate with this context */
  ref: RefObject<HTMLElement | null>;
}

/**
 * Hook that registers a UI region into the LLM context tree.
 *
 * Manages registration on mount, updates when props change,
 * and cleanup on unmount. Returns a ref to attach to the DOM node.
 *
 * @example
 * ```tsx
 * function EnvironmentFilter() {
 *   const {ref} = useLLMContext({
 *     name: 'environment-filter',
 *     entity: 'filter',
 *     description: 'Controls which environments data is filtered by',
 *     data: {selected: ['production'], available: ['production', 'staging']},
 *     actions: [{type: 'setEnvironments', description: '...', schema: {...}}],
 *     onAction: {setEnvironments: (payload) => updateEnvs(payload.environments)},
 *   });
 *
 *   return <div ref={ref}>...</div>;
 * }
 * ```
 */
export function useLLMContext({
  name,
  description,
  entity,
  data = {},
  actions = [],
  onAction,
}: UseLLMContextOptions): UseLLMContextResult {
  const registry = useContext(RegistryContext);
  const parentId = useContext(ParentContext);
  const id = useId();
  const ref = useRef<HTMLElement | null>(null);

  // Register on mount, unregister on unmount
  useEffect(() => {
    if (!registry) {
      return undefined;
    }

    registry.register({
      id,
      parentId,
      name,
      description,
      entity,
      data,
      actions,
      ref: ref.current,
    });

    return () => {
      registry.unregister(id);
    };
    // Only run on mount/unmount — updates are handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, id, parentId]);

  // Update entry when data, actions, description, entity, or name changes
  useEffect(() => {
    if (!registry) {
      return;
    }
    registry.update(id, {
      name,
      description,
      entity,
      data,
      actions,
      ref: ref.current,
    });
  }, [registry, id, name, description, entity, data, actions]);

  // Register action handlers
  useEffect(() => {
    if (!registry || !onAction) {
      return undefined;
    }

    for (const [actionType, handler] of Object.entries(onAction)) {
      registry.registerHandler(id, actionType, handler);
    }

    return () => {
      registry.unregisterHandlers(id);
    };
  }, [registry, id, onAction]);

  return {ref};
}

// ---- Component API (thin wrapper over the hook) ----

export interface LLMContextProps extends UseLLMContextOptions {
  children?: ReactNode;
}

/**
 * Component that annotates a region of the UI with metadata for the LLM.
 *
 * Wraps children in a `display: contents` span with a DOM ref.
 * For more control over the ref target, use the `useLLMContext` hook directly.
 *
 * @example
 * ```tsx
 * <LLMContext
 *   name="environment-filter"
 *   entity="filter"
 *   description="Controls which environments data is filtered by"
 *   data={{selected: ['production'], available: ['production', 'staging']}}
 *   actions={[{type: 'setEnvironments', description: '...', schema: {...}}]}
 *   onAction={{setEnvironments: (payload) => updateEnvs(payload.environments)}}
 * >
 *   <EnvironmentPageFilter />
 * </LLMContext>
 * ```
 */
export function LLMContext({children, ...options}: LLMContextProps) {
  const {ref} = useLLMContext(options);
  const id = useId();

  return (
    <ParentContext.Provider value={id}>
      <span
        ref={ref as RefObject<HTMLSpanElement>}
        data-llm-context={options.name}
        style={{display: 'contents'}}
      >
        {children}
      </span>
    </ParentContext.Provider>
  );
}

// ---- Consumer Hooks ----

const EMPTY_TREE: LLMContextNode[] = [];
const NOOP_SUBSCRIBE = () => () => {};
const NOOP_SNAPSHOT = () => 0;

/**
 * Returns the current LLM context tree.
 * Re-renders when any context node registers, unregisters, or updates.
 * Returns an empty array if used outside LLMContextRoot.
 */
export function useLLMContextTree(): LLMContextNode[] {
  const registry = useContext(RegistryContext);

  useSyncExternalStore(
    registry?.subscribe ?? NOOP_SUBSCRIBE,
    registry?.getSnapshot ?? NOOP_SNAPSHOT
  );

  return registry?.getTree() ?? EMPTY_TREE;
}

/**
 * Returns a dispatch function that sends actions to named context nodes.
 * Returns a no-op if used outside LLMContextRoot.
 *
 * @example
 * ```ts
 * const dispatch = useLLMDispatch();
 * dispatch('environment-filter', 'setEnvironments', {environments: ['staging']});
 * ```
 */
export function useLLMDispatch(): (
  contextName: string,
  actionType: string,
  payload: unknown
) => boolean {
  const registry = useContext(RegistryContext);

  return useCallback(
    (contextName: string, actionType: string, payload: unknown) => {
      return registry?.dispatch(contextName, actionType, payload) ?? false;
    },
    [registry]
  );
}
