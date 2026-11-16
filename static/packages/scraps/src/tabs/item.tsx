import type {JSX} from 'react';
import {Item as _Item} from '@react-stately/collections';
import type {ItemProps} from '@react-types/shared';

import type {LinkProps} from '@sentry/scraps/link';
import type {TooltipProps} from '@sentry/scraps/tooltip';

export interface TabListItemProps extends ItemProps<any> {
  key: string | number;
  disabled?: boolean;
  hidden?: boolean;
  to?: LinkProps['to'];
  tooltip?: TooltipProps;
}

export const TabListItem = _Item as (props: TabListItemProps) => JSX.Element;
export const TabPanelItem = _Item as (props: ItemProps<any>) => JSX.Element;
