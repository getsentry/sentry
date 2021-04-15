import React from 'react';

import {Breadcrumb, BreadcrumbType} from 'app/types/breadcrumbs';
import {Event} from 'app/types/event';

import Default from './default';
import Exception from './exception';
import Http from './http';

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
