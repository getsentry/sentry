import React from 'react';

import BreadcrumbTime from '../breadcrumbs/breadcrumbTime';
import {Breadcrumb, BreadcrumbDetails, BreadcrumbType} from '../breadcrumbs/types';
import BreadcrumbData from './breadcrumbData/breadcrumbData';
import BreadcrumbCategory from './breadcrumbCategory';
import BreadcrumbIcon from './breadcrumbIcon';
import BreadcrumbLevel from './breadcrumbLevel';
import {BreadcrumbListItem} from './styles';

type Breadcrumbs = Array<Breadcrumb & BreadcrumbDetails & {id: number}>;

type Props = {
  breadcrumbs: Breadcrumbs;
};

const BreadcrumbsListBody = ({breadcrumbs}: Props) => (
  <React.Fragment>
    {breadcrumbs.map(({color, borderColor, icon, ...crumb}, idx) => {
      const hasError =
        crumb.type === BreadcrumbType.MESSAGE || crumb.type === BreadcrumbType.EXCEPTION;
      return (
        <BreadcrumbListItem key={idx} data-test-id="breadcrumb" hasError={hasError}>
          <BreadcrumbIcon icon={icon} color={color} borderColor={borderColor} />
          <BreadcrumbCategory category={crumb.category} />
          <BreadcrumbData breadcrumb={crumb as Breadcrumb} />
          <BreadcrumbLevel level={crumb.level} />
          <BreadcrumbTime timestamp={crumb.timestamp} />
        </BreadcrumbListItem>
      );
    })}
  </React.Fragment>
);

export default BreadcrumbsListBody;
