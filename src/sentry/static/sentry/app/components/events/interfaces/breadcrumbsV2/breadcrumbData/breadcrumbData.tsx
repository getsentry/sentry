import React from 'react';

import {Event} from 'app/types';

import BreadcrumbDataDefault from './breadcrumbDataDefault';
import BreadcrumbDataException from './breadcrumbDataException';
import BreadcrumbDataHttp from './breadcrumbDataHttp';
import {Breadcrumb, BreadcrumbType} from '../types';

type Props = {
  breadcrumb: Breadcrumb;
  event: Event;
  orgId: string | null;
};

const BreadcrumbData = ({breadcrumb, event, orgId}: Props) => {
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <BreadcrumbDataHttp breadcrumb={breadcrumb} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return (
      <BreadcrumbDataException event={event} orgId={orgId} breadcrumb={breadcrumb} />
    );
  }

  return <BreadcrumbDataDefault breadcrumb={breadcrumb} />;
};

export default BreadcrumbData;
