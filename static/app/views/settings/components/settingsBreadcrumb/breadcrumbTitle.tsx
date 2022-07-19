import {PlainRoute} from 'react-router';

import {useBreadcrumbTitleEffect} from './context';

type Props = {
  routes: Array<PlainRoute>;
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
