import {type SelectOption} from 'sentry/components/core/compactSelect';

export interface TimeRangeItem extends SelectOption<string> {
  /**
   * Altenrative action handler for the time range item
   */
  onSelect?: () => void;
}
