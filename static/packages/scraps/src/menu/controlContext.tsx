import {createContext} from 'react';
import type {OverlayTriggerState} from '@react-stately/overlays';

import type {FormSize} from '@sentry/scraps/theme';

import type {SearchMatchResult, SelectKey, SelectOptionWithKey} from './selectTypes';

/**
 * A list inside the control that can act on the search query, so the control
 * can handle Enter in its search input without reading the rendered options.
 */
export interface SearchSubmitTarget {
  /**
   * Moves focus to the option with this key.
   */
  focus: (key: SelectKey) => void;
  /**
   * Keys of the options that match `search` and can be selected, in display order.
   */
  getSelectableKeys: (search: string) => SelectKey[];
  /**
   * Selects the option with this key, as if it had been clicked.
   */
  select: (key: SelectKey) => void;
}

interface ControlContextValue {
  overlayIsOpen: boolean;
  /**
   * Search string to determine whether an option should be rendered in the select list.
   */
  search: string;
  /**
   * Whether the select has a search input field.
   */
  searchable: boolean;
  disabled?: boolean;
  /**
   * Whether the matched substring of each option's label should be highlighted
   * as the user types.
   */
  highlightSearch?: boolean;
  /**
   * The control's overlay state. Useful for opening/closing the menu from inside the
   * selector.
   */
  overlayState?: OverlayTriggerState;
  /**
   * Registers a list to handle Enter in the search input. Returns an unregister
   * function.
   */
  registerSearchSubmitTarget?: (target: SearchSubmitTarget) => () => void;
  /**
   * Custom function to determine whether an option matches the search query.
   */
  searchMatcher?: (
    option: SelectOptionWithKey<SelectKey>,
    search: string
  ) => SearchMatchResult;
  size?: FormSize;
}

export const ControlContext = createContext<ControlContextValue>({
  overlayIsOpen: false,
  search: '',
  searchable: false,
});
