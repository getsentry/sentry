import {BreadcrumbsWithDetails} from './types';

function collapseCrumbSameType(breadcrumbs: BreadcrumbsWithDetails) {
  const collapsedCrumbs: BreadcrumbsWithDetails = [];

  for (let index = 0; index < breadcrumbs.length; index++) {
    const breadcrumb = breadcrumbs[index];

    if (breadcrumb.type !== breadcrumbs[index - 1]?.type) {
      collapsedCrumbs.push(breadcrumb);
      continue;
    }

    const sameTypeCrumb = collapsedCrumbs[collapsedCrumbs.length - 1];
    sameTypeCrumb?.breadcrumbs
      ? sameTypeCrumb.breadcrumbs.push(breadcrumb)
      : (sameTypeCrumb.breadcrumbs = [breadcrumb]);
  }

  return collapsedCrumbs;
}

export default collapseCrumbSameType;
