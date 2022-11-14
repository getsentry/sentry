import {Item as _Item} from '@react-stately/collections';
import {ItemProps} from '@react-types/shared';
import {LocationDescriptor} from 'history';

export interface TabListItemProps extends ItemProps<any> {
  key: React.Key;
  disabled?: boolean;
  hidden?: boolean;
  to?: LocationDescriptor;
}

export const Item = _Item as (props: TabListItemProps) => JSX.Element;
