import React from 'react';

import {getMeta} from 'app/components/events/meta/metaProxy';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from '../../breadcrumbs/types';
import BreadcrumbDataSummary from './breadcrumbDataSummary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
};

const BreadcrumbDataDefault = ({breadcrumb}: Props) => (
  <BreadcrumbDataSummary kvData={breadcrumb.data}>
    {breadcrumb?.message &&
      getBreadcrumbCustomRendererValue({
        value: breadcrumb.message,
        meta: getMeta(breadcrumb, 'message'),
      })}
  </BreadcrumbDataSummary>
);

export default BreadcrumbDataDefault;
