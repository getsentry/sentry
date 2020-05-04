import React from 'react';

import HttpRenderer from '../breadcrumbs/httpRenderer';
import DefaultRenderer from '../breadcrumbs/defaultRenderer';
import ErrorRenderer from '../breadcrumbs/errorRenderer';
import {Breadcrumb, BreadcrumbType} from '../breadcrumbs/types';

type Props = {
  breadcrumb: Breadcrumb;
};

const BreadcrumbRenderer = ({breadcrumb}: Props) => {
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <HttpRenderer breadcrumb={breadcrumb} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.MESSAGE ||
    breadcrumb.type === BreadcrumbType.EXCEPTION ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return <ErrorRenderer breadcrumb={breadcrumb} />;
  }

  return <DefaultRenderer breadcrumb={breadcrumb} />;
};

export default BreadcrumbRenderer;
