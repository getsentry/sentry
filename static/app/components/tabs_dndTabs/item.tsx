import {Item as _Item} from '@react-stately/collections';
import type {ItemProps} from '@react-types/shared';
import type {LocationDescriptor} from 'history';

export interface DroppableTabListItemProps extends ItemProps<any> {
  key: string | number;
  disabled?: boolean;
  hidden?: boolean;
  to?: LocationDescriptor;
}

export const Item = _Item as (props: DroppableTabListItemProps) => JSX.Element;
