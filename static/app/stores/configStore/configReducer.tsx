import {Config} from 'sentry/types';

function exhaustive(x?: never) {
  throw new Error(`Unhandled ${JSON.stringify(x)} switch case action in configReducer`);
}

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

export type ConfigAction<K extends keyof Config> = SetTheme | SetConfigValue<K>;
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
    default: {
      exhaustive(action);
      return state;
    }
  }
}
