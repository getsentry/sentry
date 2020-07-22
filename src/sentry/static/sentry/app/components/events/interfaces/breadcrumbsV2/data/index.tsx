import React from 'react';

import {Event} from 'app/types';

import Default from './default';
import Exception from './exception';
import Http from './http';
import {Breadcrumb, BreadcrumbType} from '../types';

type Props = {
  searchTerm: string;
  breadcrumb: Breadcrumb;
  event: Event;
  orgId: string | null;
};

const Data = ({breadcrumb, event, orgId, searchTerm}: Props) => {
  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return <Http breadcrumb={breadcrumb} searchTerm={searchTerm} />;
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return <Exception breadcrumb={breadcrumb} searchTerm={searchTerm} />;
  }

  return (
    <Default
      event={event}
      orgId={orgId}
      breadcrumb={breadcrumb}
      searchTerm={searchTerm}
    />
  );
};

export default Data;
