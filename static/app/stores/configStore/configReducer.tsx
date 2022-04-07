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
  action: ConfigAction<K>
): ConfigState {
  switch (action.type) {
    case 'set config value': {
      return {...state, [action.payload.key]: action.payload.value};
    }
    case 'set theme': {
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
