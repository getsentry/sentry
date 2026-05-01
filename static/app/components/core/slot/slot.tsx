import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {createPortal} from 'react-dom';

import {KNOWN_BRIDGED_CONTEXTS} from './knownContexts';

type Slot = string;
export type ContextBridge = {context: React.Context<any>; value: unknown};
type SlotValue = {
  contextBridges: ContextBridge[];
  counter: number;
  element: HTMLElement | null;
};

type SlotReducerState<T extends Slot> = Partial<Record<T, SlotValue>>;
type SlotReducerAction<T extends Slot> =
  | {
      name: T;
      type: 'increment counter';
    }
  | {
      name: T;
      type: 'decrement counter';
    }
  | {
      element: HTMLElement | null;
      name: T;
      type: 'register';
    }
  | {
      name: T;
      type: 'unregister';
    }
  | {
      contextBridges: ContextBridge[];
      name: T;
      type: 'set context bridges';
    };

type SlotReducer<T extends Slot> = React.Reducer<
  SlotReducerState<T>,
  SlotReducerAction<T>
>;

type SlotContextValue<T extends Slot> = [
  SlotReducerState<T>,
  React.Dispatch<SlotReducerAction<T>>,
];

function makeSlotReducer<T extends Slot>(): SlotReducer<T> {
  return function reducer(
    state: SlotReducerState<T>,
    action: SlotReducerAction<T>
  ): SlotReducerState<T> {
    switch (action.type) {
      case 'increment counter': {
        const currentSlot = state[action.name];
        return {
          ...state,
          [action.name]: {
            contextBridges: currentSlot?.contextBridges ?? [],
            element: currentSlot?.element ?? null,
            counter: (currentSlot?.counter ?? 0) + 1,
          },
        };
      }
      case 'decrement counter': {
        const currentSlot = state[action.name];
        if (!currentSlot) {
          return state;
        }
        return {
          ...state,
          [action.name]: {
            ...currentSlot,
            counter: (currentSlot?.counter ?? 0) - 1,
          },
        };
      }
      case 'register':
        return {
          ...state,
          [action.name]: {
            contextBridges: state[action.name]?.contextBridges ?? [],
            counter: state[action.name]?.counter ?? 0,
            element: action.element,
          },
        };
      case 'unregister': {
        const currentSlot = state[action.name];
        if (!currentSlot) {
          return state;
        }
        return {
          ...state,
          [action.name]: {
            contextBridges: currentSlot?.contextBridges ?? [],
            counter: currentSlot?.counter ?? 0,
            element: null,
          },
        };
      }
      case 'set context bridges': {
        const currentSlot = state[action.name];
        return {
          ...state,
          [action.name]: {
            contextBridges: action.contextBridges,
            counter: currentSlot?.counter ?? 0,
            element: currentSlot?.element ?? null,
          },
        };
      }
      default:
        return state;
    }
  };
}

interface SlotProviderProps {
  children: React.ReactNode;
}

interface SlotConsumerProps<T extends Slot> {
  children: React.ReactNode;
  name: T;
}

interface SlotOutletProps<T extends Slot> {
  children: (props: {ref: React.RefCallback<HTMLElement | null>}) => React.ReactNode;
  name: T;
}

interface SlotFallbackProps {
  children: React.ReactNode;
}

type SlotModule<T extends Slot> = React.FunctionComponent<SlotConsumerProps<T>> & {
  Fallback: React.ComponentType<SlotFallbackProps>;
  Outlet: React.ComponentType<SlotOutletProps<T>>;
  Provider: React.ComponentType<SlotProviderProps>;
  useSlotOutletRef: () => React.RefObject<HTMLElement | null>;
};

export function useContextBridges(contexts: Array<React.Context<any>>): ContextBridge[] {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- safe: contexts is a module constant with stable length
  const values = contexts.map(ctx => useContext(ctx));
  const prevRef = useRef<ContextBridge[]>([]);

  const changed =
    prevRef.current.length !== contexts.length ||
    prevRef.current.some((bridge, i) => bridge.value !== values[i]);

  if (changed) {
    prevRef.current = contexts.map((ctx, i) => ({context: ctx, value: values[i]}));
  }

  return prevRef.current;
}

function makeSlotConsumer<T extends Slot>(options: {
  context: React.Context<SlotContextValue<T> | null>;
  outletNameContext: React.Context<T | null>;
}) {
  const {context, outletNameContext} = options;

  function SlotConsumer(props: SlotConsumerProps<T>): React.ReactNode {
    const ctx = useContext(context);
    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const [state, dispatch] = ctx;
    const {name} = props;
    useLayoutEffect(() => {
      dispatch({type: 'increment counter', name});
      return () => dispatch({type: 'decrement counter', name});
    }, [dispatch, name]);

    const element = state[name]?.element;
    if (!element) {
      return null;
    }

    let content: React.ReactNode = (
      <outletNameContext.Provider value={name}>
        {props.children}
      </outletNameContext.Provider>
    );

    const bridges = state[name]?.contextBridges;
    if (bridges) {
      for (let i = bridges.length - 1; i >= 0; i--) {
        const bridge = bridges[i]!;
        content = <bridge.context value={bridge.value}>{content}</bridge.context>;
      }
    }

    return createPortal(content, element);
  }

  SlotConsumer.displayName = 'Slot.Consumer';
  return SlotConsumer;
}

function makeSlotOutlet<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>,
  outletNameContext: React.Context<T | null>
) {
  function SlotOutlet(props: SlotOutletProps<T>): React.ReactNode {
    const ctx = useContext(context);

    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const [, dispatch] = ctx;
    const {name} = props;

    const contextBridges = useContextBridges(KNOWN_BRIDGED_CONTEXTS);

    useLayoutEffect(() => {
      dispatch({type: 'set context bridges', name, contextBridges});
      return () => dispatch({type: 'set context bridges', name, contextBridges: []});
    }, [dispatch, name, contextBridges]);

    const ref = useCallback(
      (element: HTMLElement | null) => {
        if (!element) {
          dispatch({type: 'unregister', name});
          return;
        }
        dispatch({type: 'register', name, element});
      },
      [dispatch, name]
    );

    return (
      <outletNameContext.Provider value={name}>
        {props.children({ref})}
      </outletNameContext.Provider>
    );
  }

  SlotOutlet.displayName = 'Slot.Outlet';
  return SlotOutlet;
}

function makeSlotFallback<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>,
  outletNameContext: React.Context<T | null>
) {
  function SlotFallback({children}: SlotFallbackProps): React.ReactNode {
    const ctx = useContext(context);
    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const name = useContext(outletNameContext);
    if (name === null) {
      throw new Error('Slot.Fallback must be rendered inside Slot.Outlet');
    }

    const [state] = ctx;
    if ((state[name]?.counter ?? 0) > 0 || !state[name]?.element) {
      return null;
    }

    return createPortal(children, state[name].element);
  }

  SlotFallback.displayName = 'Slot.Fallback';
  return SlotFallback;
}

function makeSlotProvider<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>
): (props: SlotProviderProps) => React.ReactNode {
  const reducer = makeSlotReducer<T>();

  function SlotProvider({children}: SlotProviderProps) {
    const [value, dispatch] = useReducer(reducer, {});

    const contextValue = useMemo(
      () => [value, dispatch] satisfies SlotContextValue<T>,
      [value, dispatch]
    );
    return <context.Provider value={contextValue}>{children}</context.Provider>;
  }

  SlotProvider.displayName = 'Slot.Provider';
  return SlotProvider;
}

function makeUseSlotOutletRef<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>,
  outletNameContext: React.Context<T | null>
): () => React.RefObject<HTMLElement | null> {
  return function useSlotOutletRef(): React.RefObject<HTMLElement | null> {
    const ctx = useContext(context);
    const name = useContext(outletNameContext);
    const ref = useRef<HTMLElement | null>(null);

    // Synchronously keep ref.current in sync with the outlet element for the
    // current slot. Safe to assign during render since it's a ref mutation.
    ref.current = ctx && name ? (ctx[0][name]?.element ?? null) : null;

    return ref;
  };
}

export function slot<T extends readonly Slot[]>(names: T): SlotModule<T[number]> {
  type SlotName = T[number];

  const SlotContext = createContext<SlotContextValue<SlotName> | null>(null);
  const OutletNameContext = createContext<SlotName | null>(null);

  const Slot = makeSlotConsumer<SlotName>({
    context: SlotContext,
    outletNameContext: OutletNameContext,
  }) as SlotModule<SlotName>;
  Slot.Provider = makeSlotProvider<SlotName>(SlotContext);
  Slot.Outlet = makeSlotOutlet<SlotName>(SlotContext, OutletNameContext);
  Slot.Fallback = makeSlotFallback<SlotName>(SlotContext, OutletNameContext);
  Slot.useSlotOutletRef = makeUseSlotOutletRef<SlotName>(SlotContext, OutletNameContext);

  // Keep `names` reference to preserve the const-narrowed type T
  void names;

  return Slot;
}

export function withSlots<
  TComponent extends React.ComponentType<any>,
  TSlot extends Slot,
>(
  Component: TComponent,
  slotModule: SlotModule<TSlot>
): TComponent & {Slot: SlotModule<TSlot>} {
  const WithSlots = Component as TComponent & {Slot: SlotModule<TSlot>};
  WithSlots.Slot = slotModule;
  return WithSlots;
}
