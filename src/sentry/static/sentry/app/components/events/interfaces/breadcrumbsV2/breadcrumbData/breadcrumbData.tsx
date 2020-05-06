import React from 'react';

import BreadcrumbDataDefault from './breadcrumbDataDefault';
import BreadcrumbDataException from './breadcrumbDataException';
import BreadcrumbDataHttp from './breadcrumbDataHttp';
import {Breadcrumb, BreadcrumbType} from '../../breadcrumbs/types';

type Props = {
  breadcrumb: Breadcrumb;
};

const BreadcrumbData = ({breadcrumb}: Props) => {
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <BreadcrumbDataHttp breadcrumb={breadcrumb} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.MESSAGE ||
    breadcrumb.type === BreadcrumbType.EXCEPTION ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return <BreadcrumbDataException breadcrumb={breadcrumb} />;
  }

  return <BreadcrumbDataDefault breadcrumb={breadcrumb} />;
};

export default BreadcrumbData;
