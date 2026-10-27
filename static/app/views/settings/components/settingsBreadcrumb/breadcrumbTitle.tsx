import {useContext} from 'react';

import type {
  BreadcrumbListProps,
  BreadcrumbTitleItem,
} from '@sentry/scraps/breadcrumbList';

import {TopBar} from 'sentry/views/navigation/topBar';

import {SettingsBreadcrumbsContext} from './context';

type Props = {
  title: string | BreadcrumbTitleItem;
  breadcrumbs?: BreadcrumbListProps['items'];
};

export function BreadcrumbTitle({title, breadcrumbs = []}: Props) {
  const parents = useContext(SettingsBreadcrumbsContext);
  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={typeof title === 'string' ? {type: 'page-title', label: title} : title}
      items={[...parents, ...breadcrumbs]}
    />
  );
}
