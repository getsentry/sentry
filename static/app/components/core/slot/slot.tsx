import {
  createContext,
  use,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';
import * as Sentry from '@sentry/react';

import {KNOWN_BRIDGED_CONTEXTS} from './knownContexts';

const NOOP_REF_CALLBACK: React.RefCallback<HTMLElement | null> = () => {};
const EMPTY_STATE: SlotReducerState<any> = {};
const NOOP_DISPATCH: React.Dispatch<SlotReducerAction<any>> = () => {};

const reportedSlotWarnings = new Set<string>();

function reportSlotWarning(
  type: 'missing-provider',
  component: string,
  slotName: string,
  message: string
): void {
  const key = `${type}:${component}:${slotName}`;
  if (reportedSlotWarnings.has(key)) {
    return;
  }
  reportedSlotWarnings.add(key);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(message);
    return;
  }

  Sentry.withScope(scope => {
    scope.setLevel('warning');
    scope.setTag('slot.component', component);
    scope.setTag('slot.name', slotName);
    scope.setFingerprint([`slot-${type}`, component, slotName]);
    Sentry.captureException(new Error(message));
  });
}

type Slot = string;
type ContextBridge = {context: React.Context<any>; value: unknown};
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
    }
  | {
      name: T;
      type: 'remove context bridges';
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
      case 'remove context bridges': {
        const currentSlot = state[action.name];
        return {
          ...state,
          [action.name]: {
            contextBridges: [],
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

function useContextBridges(): ContextBridge[] {
  const values = KNOWN_BRIDGED_CONTEXTS.map(ctx => use(ctx));
  const [prev, setPrev] = useState<ContextBridge[]>([]);

  const changed =
    prev.length !== KNOWN_BRIDGED_CONTEXTS.length ||
    prev.some((bridge, i) => bridge.value !== values[i]);

  if (changed) {
    const next = KNOWN_BRIDGED_CONTEXTS.map((ctx, i) => ({
      context: ctx,
      value: values[i],
    }));
    setPrev(next);
    return next;
  }

  return prev;
}

function makeSlotConsumer<T extends Slot>(options: {
  context: React.Context<SlotContextValue<T> | null>;
  outletNameContext: React.Context<T | null>;
}) {
  const {context, outletNameContext} = options;

  function SlotConsumer(props: SlotConsumerProps<T>): React.ReactNode {
    const ctx = useContext(context);
    const [state, dispatch] = ctx ?? [EMPTY_STATE, NOOP_DISPATCH];
    const {name} = props;
    const element = state[name]?.element;

    useLayoutEffect(() => {
      if (dispatch === NOOP_DISPATCH) {
        return;
      }
      dispatch({type: 'increment counter', name});
      return () => dispatch({type: 'decrement counter', name});
    }, [dispatch, name]);

    if (!ctx) {
      reportSlotWarning(
        'missing-provider',
        'Consumer',
        name,
        `<Slot.Consumer> for slot "${name}" rendered without a <Slot.Provider>`
      );
      return null;
    }

    if (!element) {
      return null;
    }

    // Provide initial internal outlet context
    let content: React.ReactNode = (
      <outletNameContext.Provider value={name}>
        {props.children}
      </outletNameContext.Provider>
    );

    const bridges = state[name]?.contextBridges;
    if (bridges) {
      content = bridges
        .toReversed()
        .reduce(
          (children, bridge) => (
            <bridge.context value={bridge.value}>{children}</bridge.context>
          ),
          content
        );
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
    const [, dispatch] = ctx ?? [EMPTY_STATE, NOOP_DISPATCH];
    const {name} = props;

    const contextBridges = useContextBridges();

    useLayoutEffect(() => {
      dispatch({type: 'set context bridges', name, contextBridges});
      return () => dispatch({type: 'remove context bridges', name});
    }, [dispatch, name, contextBridges]);

    const ref = useCallback(
      (element: HTMLElement | null) => {
        if (dispatch === NOOP_DISPATCH) {
          return;
        }
        if (!element) {
          dispatch({type: 'unregister', name});
          return;
        }
        dispatch({type: 'register', name, element});
      },
      [dispatch, name]
    );

    if (!ctx) {
      reportSlotWarning(
        'missing-provider',
        'Outlet',
        name,
        `<Slot.Outlet> for slot "${name}" rendered without a <Slot.Provider>`
      );
      return props.children({ref: NOOP_REF_CALLBACK});
    }

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
    const name = useContext(outletNameContext);

    if (!ctx) {
      reportSlotWarning(
        'missing-provider',
        'Fallback',
        name ?? 'unknown',
        `<Slot.Fallback> for slot "${name ?? 'unknown'}" rendered without a <Slot.Provider>`
      );
      return null;
    }

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
