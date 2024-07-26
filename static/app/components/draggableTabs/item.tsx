import {Item as _Item} from '@react-stately/collections';
import type {ItemProps} from '@react-types/shared';
import type {LocationDescriptor} from 'history';

export interface DraggableTabListItemProps extends ItemProps<any> {
  key: string | number;
  count?: number;
  disabled?: boolean;
  hasUnsavedChanges?: boolean;
  hidden?: boolean;
  to?: LocationDescriptor;
}

export const Item = _Item as (props: DraggableTabListItemProps) => JSX.Element;
