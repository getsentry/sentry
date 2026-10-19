import type {ListItemsProps} from '@sentry/scraps/menu';

/**
 * The option format used by react-select based components
 */
export interface SelectValue<T> extends ListItemsProps {
  value: T;
  /**
   * In scenarios where you're using a react element as the label react-select
   * will be unable to filter to that label. Use this to specify the plain text of
   * the label.
   */
  textValue?: string;
}
