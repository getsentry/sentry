import {useMemo} from 'react';

import {useRoutes} from 'sentry/utils/useRoutes';

import {useBreadcrumbTitleEffect} from './context';

type Props = {
  title: string;
};

/**
 * Breadcrumb title sets the breadcrumb label for the provided route match
 */
export function BreadcrumbTitle({title}: Props) {
  const routes = useRoutes();
  const props = useMemo(() => ({routes, title}), [routes, title]);
  useBreadcrumbTitleEffect(props);

  return null;
}
