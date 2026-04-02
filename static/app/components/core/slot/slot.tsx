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
      case 'unregister':
        return {
          ...state,
          [action.name]: undefined,
        };
      default:
        return state;
    }
  };
}

interface SlotComponentProps {
  children: React.ReactNode;
}

type SlotComponent<T extends Slot> = React.FunctionComponent<SlotComponentProps> & {
  Fallback: ReturnType<typeof makeSlotFallback<T>>;
  Root: ReturnType<typeof makeSlotRoot<T>>;
};

function makeSlotComponent<T extends Slot>(
  name: T,
  context: React.Context<SlotContextValue<T> | null>
) {
  function SlotComponent(props: SlotComponentProps): React.ReactNode {
    const ctx = useContext(context);
    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const [state, dispatch] = ctx;
    useLayoutEffect(() => {
      dispatch({type: 'increment counter', name});
      return () => dispatch({type: 'decrement counter', name});
    }, [dispatch]);

    const element = state[name]?.element;
    if (!element) {
      // Render in place as a fallback when no target element is registered yet
      return props.children;
    }
    return createPortal(props.children, element);
  }

  SlotComponent.Fallback = makeSlotFallback(name, context);
  SlotComponent.Root = makeSlotRoot(name, context);
  SlotComponent.displayName = `Slot.(${name})`;

  return SlotComponent;
}

interface SlotRootProps {
  children: (props: {ref: React.RefCallback<HTMLElement | null>}) => React.ReactNode;
}

function makeSlotRoot<T extends Slot>(
  name: T,
  context: React.Context<SlotContextValue<T> | null>
) {
  return function SlotRoot(props: SlotRootProps): React.ReactNode {
    const ctx = useContext(context);

    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const [, dispatch] = ctx;
    const ref = useCallback(
      (element: HTMLElement | null) => {
        if (!element) {
          dispatch({type: 'unregister', name});
          return;
        }
        dispatch({type: 'register', name, element});
      },
      [dispatch]
    );

    return props.children({ref});
  };
}
function makeSlotFallback<T extends Slot>(
  name: T,
  context: React.Context<SlotContextValue<T> | null>
) {
  return function SlotFallback(props: SlotComponentProps): React.ReactNode {
    const ctx = useContext(context);
    if (!ctx) {
      throw new Error('SlotContext not found');
    }

    const [state] = ctx;

    if ((state[name]?.counter ?? 0) > 0 || !state[name]?.element) {
      return null;
    }

    return createPortal(props.children, state[name]?.element);
  };
}

interface SlotProviderProps {
  children: React.ReactNode;
}

function makeSlotProvider<T extends Slot>(
  context: React.Context<SlotContextValue<T> | null>
): (props: SlotProviderProps) => React.ReactNode {
  function SlotProvider({children}: SlotProviderProps) {
    const [value, dispatch] = useReducer(makeSlotReducer<T>(), {});

    const contextValue = useMemo(
      () => [value, dispatch] satisfies SlotContextValue<T>,
      [value, dispatch]
    );
    return <context.Provider value={contextValue}>{children}</context.Provider>;
  }

  SlotProvider.displayName = `Slot.Provider`;
  return SlotProvider as (props: SlotProviderProps) => React.ReactNode;
}

interface SlotModule<T extends readonly Slot[]> {
  Provider: React.ComponentType<SlotProviderProps>;
  slot: {[K in T[number]]: SlotComponent<K>};
}

export function slot<T extends readonly Slot[]>(names: T): SlotModule<T> {
  type SlotName = T[number];

  const SlotContext = createContext<SlotContextValue<SlotName> | null>(null);
  const SlotProvider = makeSlotProvider<SlotName>(SlotContext);

  const slots = {} as {[K in SlotName]: SlotComponent<K>};
  for (const name of names) {
    slots[name as SlotName] = makeSlotComponent<SlotName>(name, SlotContext);
  }

  return {
    Provider: SlotProvider,
    slot: slots,
  };
}
