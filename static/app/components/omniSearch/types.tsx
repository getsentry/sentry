import {MenuItemProps} from 'sentry/components/dropdownMenu';
import {SVGIconProps} from 'sentry/icons/svgIcon';

type UnregisterCallback = () => void;

export interface OmniSearchConfig {
  /**
   * Used to register actions into the omni-search.
   */
  registerActions: (actions: OmniAction[]) => UnregisterCallback;
  /**
   * Register the area priority stack. This is controlled by the OmniSearchArea
   * context provider
   */
  registerAreaPriority: (areaPriority: string[]) => UnregisterCallback;
  /**
   * Used to register an "Area" within the omni search. You can group an
   * OmniAction into an area by specifying the `areaKey` on the OmniAction.
   */
  registerAreas: (areas: OmniArea[]) => UnregisterCallback;
}

export interface OmniArea {
  key: string;
  /**
   * Indicates this area has high contextual relevancy to the user. This is
   * used when an area is prioritized via the areaPriority list.
   */
  focused?: boolean;
  /**
   * Leaving label blank will cause actions to be grouped, but will not
   */
  label?: React.ReactNode;
}

/**
 * The datastructure representing the state of the OmniSearch
 */
export interface OmniSearchStore {
  /**
   * Registered actions
   */
  actions: OmniAction[];
  /**
   * Represents the order priority of areas by area key.
   */
  areaPriority: string[];
  /**
   * List of areas available in the omni-search
   */
  areas: OmniArea[];
}

export interface OmniAction extends MenuItemProps {
  /**
   * Specify the area (by key name) the action belongs to
   */
  areaKey: string;
  /**
   * The global hotkey used to trigger the action. This uses the same format
   * as useHotkey.
   */
  actionHotkey?: string;
  /**
   * Icon to render in the leadingItems of the menu item.
   */
  actionIcon?: React.ComponentType<SVGIconProps>;
  /**
   * The actionType will cause actions to be grouped together by action type.
   * Useful for example if you have multiple copy actions you want to visually
   * represent in a single group.
   */
  actionType?: string;
  fullLabel?: string;
  /**
   * Additional words that are used to search on.
   */
  keywords?: string[];
}

export interface OmniSection {
  actions: OmniAction[];
  key: string;
  ['aria-label']?: string;
  label?: React.ReactNode;
}
