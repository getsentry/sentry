import convertCrumbType from './convertCrumbType';
import getCrumbDetails from './getCrumbDetails';
import {Breadcrumb, BreadcrumbsWithDetails} from './types';

type CollapsedBreadcrumbs = Array<
  BreadcrumbsWithDetails[0] & {breadcrumbs?: BreadcrumbsWithDetails}
>;

const transformCrumbs = (breadcrumbs: Array<Breadcrumb>): CollapsedBreadcrumbs => {
  const collapsedcrumbs: CollapsedBreadcrumbs = [];

  for (let index = 0; index < breadcrumbs.length; index++) {
    const breadcrumb = breadcrumbs[index];
    const convertedCrumbType = convertCrumbType(breadcrumb);
    const crumbDetails = getCrumbDetails(convertedCrumbType.type);
    const transformedCrumb = {
      id: index,
      ...convertedCrumbType,
      ...crumbDetails,
    };

    console.log(
      'transformedCrumb.type',
      transformedCrumb.type,
      breadcrumbs[index - 1]?.type
    );
    if (transformedCrumb.type !== breadcrumbs[index - 1]?.type) {
      collapsedcrumbs.push(transformedCrumb);
      continue;
    }

    const sameTypeCrumb = collapsedcrumbs[collapsedcrumbs.length - 1];
    sameTypeCrumb?.breadcrumbs
      ? sameTypeCrumb.breadcrumbs.push(transformedCrumb)
      : (sameTypeCrumb.breadcrumbs = [transformedCrumb]);
  }

  return collapsedcrumbs;
};

export default transformCrumbs;
