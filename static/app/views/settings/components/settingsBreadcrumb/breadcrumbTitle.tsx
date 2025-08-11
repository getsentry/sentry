import type {PlainRoute} from 'sentry/types/legacyReactRouter';

import {useBreadcrumbTitleEffect} from './context';

type Props = {
  routes: PlainRoute[];
  title: string;
};

/**
 * Breadcrumb title sets the breadcrumb label for the provided route match
 */
function BreadcrumbTitle(props: Props) {
  useBreadcrumbTitleEffect(props);

  return null;
}

export default BreadcrumbTitle;
