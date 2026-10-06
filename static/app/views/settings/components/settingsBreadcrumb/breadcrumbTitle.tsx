import {useMemo} from 'react';
import {useMatches} from 'react-router-dom';

import {BreadcrumbList, type BreadcrumbTitleItem} from '@sentry/scraps/breadcrumbList';

import {TopBar} from 'sentry/views/navigation/topBar';

import {useBreadcrumbTitleEffect} from './context';

type Props = {
  title: string | BreadcrumbTitleItem;
  breadcrumbs?: React.ComponentProps<typeof BreadcrumbList>['items'];
};

/**
 * Breadcrumb title sets the breadcrumb label for the provided route match
 */
export function BreadcrumbTitle({title, breadcrumbs}: Props) {
  const matches = useMatches();
  const props = useMemo(
    () => ({matches, title, breadcrumbs}),
    [matches, title, breadcrumbs]
  );
  const hasProvider = useBreadcrumbTitleEffect(props);

  // Register typed titles directly when no settings layout owns the breadcrumbs.
  if (!hasProvider && typeof title !== 'string') {
    return (
      <TopBar.Slot name="breadcrumbs" title={title}>
        {breadcrumbs && <BreadcrumbList items={breadcrumbs} />}
      </TopBar.Slot>
    );
  }

  return null;
}
