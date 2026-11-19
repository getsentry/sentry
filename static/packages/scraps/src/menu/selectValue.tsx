import type {ListItemProps} from './menu';

/** A choice displayed by Scraps Select. */
export interface SelectValue<T> extends ListItemProps {
  value: T;
  /**
   * Plain text for searching and for labels that contain React elements.
   */
  textValue?: string;
}
