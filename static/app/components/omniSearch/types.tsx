import {MenuItemProps} from 'sentry/components/dropdownMenu';

type UnregisterCallback = () => void;

export interface OmniSearchConfig {
  registerActions: (actions: OmniAction[]) => UnregisterCallback;
}

export interface OmniSearchStore {
  actions: OmniAction[];
}

export interface OmniAction extends MenuItemProps {}
