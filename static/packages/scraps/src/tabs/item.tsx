import type {JSX} from 'react';
import {Item as _Item} from '@react-stately/collections';
import type {ItemProps} from '@react-types/shared';

import type {LinkProps} from '@sentry/scraps/link';
import type {TooltipProps} from '@sentry/scraps/tooltip';

import type {TabKey} from './tabs';

interface BaseTabListItemProps<T extends TabKey> extends ItemProps<any> {
  key: T;
  disabled?: boolean;
  hidden?: boolean;
  tooltip?: TooltipProps;
}

export interface TabListItemProps<
  T extends TabKey = TabKey,
> extends BaseTabListItemProps<T> {
  to?: never;
}

export interface LinkTabListItemProps<
  T extends TabKey = TabKey,
> extends BaseTabListItemProps<T> {
  to: NonNullable<LinkProps['to']>;
}

export type InternalTabListItemProps = TabListItemProps | LinkTabListItemProps;

export interface TabPanelItemProps<T extends TabKey = TabKey> extends ItemProps<any> {
  key: T;
}

export const TabListItem = _Item as (props: InternalTabListItemProps) => JSX.Element;
export const TabPanelItem = _Item as (props: TabPanelItemProps) => JSX.Element;
