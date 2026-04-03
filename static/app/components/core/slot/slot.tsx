import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
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

interface SlotFallbackProps<T extends Slot> {
  children: React.ReactNode;
  name: T;
}

type SlotProviderComponent<T extends Slot> =
  React.FunctionComponent<SlotProviderProps> & {
    Fallback: React.ComponentType<SlotFallbackProps<T>>;
    Outlet: React.ComponentType<SlotOutletProps<T>>;
    Slot: React.ComponentType<SlotConsumerProps<T>>;
  };

function makeSlotConsumer<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>
) {
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
      // Render in place as a fallback when no target element is registered yet
      return props.children;
    }
    return createPortal(props.children, element);
  }

  SlotConsumer.displayName = 'Slot.Consumer';
  return SlotConsumer;
}

function makeSlotOutlet<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>
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

    return props.children({ref});
  }

  SlotOutlet.displayName = 'Slot.Outlet';
  return SlotOutlet;
}

function makeSlotFallback<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>
) {
  function SlotFallback(props: SlotFallbackProps<T>): React.ReactNode {
    const ctx = useContext(context);
    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const [state] = ctx;
    const {name} = props;

    if ((state[name]?.counter ?? 0) > 0 || !state[name]?.element) {
      return null;
    }

    return createPortal(props.children, state[name]?.element);
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

  SlotProvider.displayName = `Slot.Provider`;
  return SlotProvider as (props: SlotProviderProps) => React.ReactNode;
}

export function slot<T extends readonly Slot[]>(
  names: T
): SlotProviderComponent<T[number]> {
  type SlotName = T[number];

  const SlotContext = createContext<SlotContextValue<SlotName> | null>(null);
  const Provider = makeSlotProvider<SlotName>(
    SlotContext
  ) as SlotProviderComponent<SlotName>;

  Provider.Slot = makeSlotConsumer<SlotName>(SlotContext);
  Provider.Outlet = makeSlotOutlet<SlotName>(SlotContext);
  Provider.Fallback = makeSlotFallback<SlotName>(SlotContext);

  // Keep `names` reference to preserve the const-narrowed type T
  void names;

  return Provider;
}
