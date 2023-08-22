import {MenuItemProps} from 'sentry/components/dropdownMenu';
import {SVGIconProps} from 'sentry/icons/svgIcon';

type UnregisterCallback = () => void;

export interface OmniSearchConfig {
  /**
   * Used to register actions into the omni-search.
   */
  registerActions: (actions: OmniAction[]) => UnregisterCallback;
  /**
   * Used to register an "Area" within the omni search. You can group an
   * OmniAction into an area by specifying the `areaKey` on the OmniAction.
   */
  registerAreas: (areas: OmniArea[]) => UnregisterCallback;
}

export interface OmniArea {
  key: string;
  /**
   * Leaving label blank will cause actions to be grouped, but will not
   */
  label?: React.ReactNode;
}

/**
 * Maps the area key to the OmniArea object
 */
export type OmniAreaMap = Record<string, OmniArea>;

/**
 * The datastructure representing the state of the OmniSearch
 */
export interface OmniSearchStore {
  actions: OmniAction[];
  areas: OmniAreaMap;
}

export interface OmniAction extends MenuItemProps {
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
  /**
   * Specfiy the area (by key name) the action belongs to
   */
  areaKey?: string;
}
