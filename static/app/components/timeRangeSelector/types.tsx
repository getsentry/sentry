import {type SelectOption} from '@sentry/scraps/compactSelect';

export interface TimeRangeItem extends SelectOption<string> {
  /**
   * Alternative action handler for the time range item
   */
  onSelect?: () => void;
}
