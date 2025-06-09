import {Item as _Item} from '@react-stately/collections';
import type {ItemProps} from '@react-types/shared';
import type {LocationDescriptor} from 'history';

export interface TabListItemProps extends ItemProps<any> {
  key: string | number;
  disabled?: boolean;
  hidden?: boolean;
  to?: LocationDescriptor;
}

export const TabListItem = _Item as (props: TabListItemProps) => React.JSX.Element;
export const TabPanelItem = _Item as (props: ItemProps<any>) => React.JSX.Element;
