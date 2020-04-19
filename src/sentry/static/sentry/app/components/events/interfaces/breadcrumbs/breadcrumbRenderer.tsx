import React from 'react';

import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';

import {Breadcrumb} from './types';

type Props = {
  breadcrumb: Breadcrumb;
};

const BreadcrumbRenderer = ({breadcrumb}: Props) => {
  if (breadcrumb.type === 'http') {
    return <HttpRenderer breadcrumb={breadcrumb} />;
  }

  if (
    breadcrumb.type === 'warning' ||
    breadcrumb.type === 'message' ||
    breadcrumb.type === 'exception' ||
    breadcrumb.type === 'error'
  ) {
    return <ErrorRenderer breadcrumb={breadcrumb} />;
  }

  return <DefaultRenderer breadcrumb={breadcrumb} />;
};

export default BreadcrumbRenderer;
