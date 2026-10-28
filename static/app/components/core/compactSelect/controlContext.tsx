import {createContext} from 'react';
import type {OverlayTriggerState} from '@react-stately/overlays';

import type {FormSize} from '@sentry/scraps/theme';

import type {SearchMatchResult, SelectKey, SelectOptionWithKey} from './types';

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
