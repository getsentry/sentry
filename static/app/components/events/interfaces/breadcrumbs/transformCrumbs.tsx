import {Breadcrumb, BreadcrumbLevelType} from 'app/types/breadcrumbs';

import convertCrumbType from './convertCrumbType';
import getCrumbDetails from './getCrumbDetails';

const transformCrumbs = (breadcrumbs: Array<Breadcrumb>) =>
  breadcrumbs.map((breadcrumb, index) => {
    const convertedCrumbType = convertCrumbType(breadcrumb);
    const crumbDetails = getCrumbDetails(convertedCrumbType.type);
    return {
      id: index,
      ...convertedCrumbType,
      ...crumbDetails,
      level: convertedCrumbType?.level ?? BreadcrumbLevelType.UNDEFINED,
    };
  });

export default transformCrumbs;
