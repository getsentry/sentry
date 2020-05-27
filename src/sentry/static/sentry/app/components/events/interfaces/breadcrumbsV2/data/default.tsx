import React from 'react';

import {getMeta} from 'app/components/events/meta/metaProxy';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from '../types';
import {Summary} from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
};

const Default = ({breadcrumb}: Props) => (
  <Summary kvData={breadcrumb.data}>
    {breadcrumb?.message &&
      getBreadcrumbCustomRendererValue({
        value: breadcrumb.message,
        meta: getMeta(breadcrumb, 'message'),
      })}
  </Summary>
);

export {Default};
