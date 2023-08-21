import {MenuItemProps} from 'sentry/components/dropdownMenu';

type ActionKey = string;

export interface OmniSearchConfig {
  registerActions: (actions: OmniAction[]) => void;
  unregisterActions: (keys: Array<OmniAction | ActionKey>) => void;
}

export interface OmniSearchStore {
  actions: OmniAction[];
}

export interface OmniAction extends MenuItemProps {}
