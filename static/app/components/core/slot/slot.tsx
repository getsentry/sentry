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

type Slot = string;
type SlotValue = {counter: number; element: HTMLElement | null};

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
            counter: currentSlot?.counter ?? 0,
            element: null,
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

function makeSlotConsumer<T extends Slot>(options: {
  context: React.Context<SlotContextValue<T> | null>;
  outletNameContext: React.Context<T | null>;
  providers?: React.ComponentType<{children: React.ReactNode}>;
}) {
  const {context, outletNameContext, providers: Providers} = options;

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

    // Provide outletNameContext from the consumer so that portaled children
    // (which don't descend through the outlet in the component tree) can still
    // read which slot they belong to via useSlotOutletRef.
    const wrappedChildren = (
      <outletNameContext.Provider value={name}>
        {props.children}
      </outletNameContext.Provider>
    );

    const element = state[name]?.element;
    const content = Providers ? (
      <Providers>{wrappedChildren}</Providers>
    ) : (
      wrappedChildren
    );

    if (!element) {
      return null;
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
  return SlotProvider as (props: SlotProviderProps) => React.ReactNode;
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

export function slot<T extends readonly Slot[]>(
  names: T,
  options?: {providers?: React.ComponentType<{children: React.ReactNode}>}
): SlotModule<T[number]> {
  type SlotName = T[number];

  const SlotContext = createContext<SlotContextValue<SlotName> | null>(null);
  const OutletNameContext = createContext<SlotName | null>(null);

  const Slot = makeSlotConsumer<SlotName>({
    context: SlotContext,
    outletNameContext: OutletNameContext,
    providers: options?.providers,
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
