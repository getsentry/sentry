import LegacyConfigStore from 'sentry/stores/configStore';
import {Config} from 'sentry/types';

function exhaustive(x?: never) {
  throw new Error(`Unhandled ${JSON.stringify(x)} switch case action in configReducer`);
}

// This action is here for legacy reasons and allows us to patch the reducer
// state once the LegacyStore listenTo has fired.
type Patch = {
  payload: Partial<ConfigState>;
  type: 'patch';
};

type SetTheme = {
  payload: 'light' | 'dark';
  type: 'set theme';
};

type SetConfigValue<K extends keyof Config> = {
  payload: {
    key: K;
    value: Config[K];
  };
  type: 'set config value';
};

export type ConfigAction<K extends keyof Config> = SetTheme | SetConfigValue<K> | Patch;
export type ConfigState = Config;

export function configReducer<K extends keyof Config>(
  state: ConfigState,
  action: ConfigAction<K>,
  bridgeReflux?: boolean
): ConfigState {
  switch (action.type) {
    case 'set config value': {
      // XXX: side effect that bridges reflux and reducer, keeping the two stores in sync
      if (bridgeReflux) {
        // We need to escape the React lifecycle update or this will result in an "calling setState inside setState error"
        window.setTimeout(() => {
          LegacyConfigStore.set(action.payload.key, action.payload.value);
        });
      }
      return {...state, [action.payload.key]: action.payload.value};
    }
    case 'set theme': {
      // XXX: side effect that bridges reflux and reducer, keeping the two stores in sync
      if (bridgeReflux) {
        // We need to escape the React lifecycle update or this will result in an "calling setState inside setState error"
        window.setTimeout(() => {
          LegacyConfigStore.updateTheme(action.payload);
        });
      }
      return {...state, theme: action.payload};
    }
    case 'patch': {
      // Since the source of patch actions is the LegacyConfigStore itself, it is important
      // that we do not call any methods on the LegacyConfigStore or we will infinitely loop
      return {...state, ...action.payload};
    }
    default: {
      exhaustive(action);
      return state;
    }
  }
}
type BridgableReducer<S, A, F extends boolean> = (state: S, action: A, flag: F) => S;

type BridgableReducerState<R extends BridgableReducer<any, any, boolean>> =
  R extends BridgableReducer<infer S, any, any> ? S : never;

type BridgableReducerAction<R extends BridgableReducer<any, any, boolean>> =
  R extends BridgableReducer<any, infer A, any> ? A : never;

export function makeBridgableReducer<T extends BridgableReducer<any, any, boolean>>(
  reducer: T,
  flag: boolean
): (
  state: BridgableReducerState<T>,
  action: BridgableReducerAction<T>
) => BridgableReducerState<T> {
  return (state: BridgableReducerState<T>, action: BridgableReducerAction<T>) => {
    return reducer(state, action, flag);
  };
}
