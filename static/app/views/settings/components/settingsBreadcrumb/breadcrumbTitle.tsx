import {useMemo} from 'react';

import {useMatches} from 'sentry/router/reactRouter';

import {useBreadcrumbTitleEffect} from './context';

type Props = {
  title: string;
};

/**
 * Breadcrumb title sets the breadcrumb label for the provided route match
 */
export function BreadcrumbTitle({title}: Props) {
  const matches = useMatches();
  const props = useMemo(() => ({matches, title}), [matches, title]);
  useBreadcrumbTitleEffect(props);

  return null;
}
