import React from 'react';
import omit from 'lodash/omit';

import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';
import {BreadcrumbTypeDefault} from '../../breadcrumbs/types';
import BreadcrumbDataSummary from './breadcrumbDataSummary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
};

const BreadcrumbDataException = ({breadcrumb}: Props) => {
  const {data} = breadcrumb;
  const dataValue = data?.value;

  return (
    <BreadcrumbDataSummary kvData={omit(data, ['type', 'value'])}>
      {data?.type &&
        getBreadcrumbCustomRendererValue({
          value: <strong>{`${data.type}: `}</strong>,
          meta: getMeta(data, 'type'),
        })}
      {defined(dataValue) &&
        getBreadcrumbCustomRendererValue({
          value: breadcrumb?.message ? `${dataValue}. ` : dataValue,
          meta: getMeta(data, 'value'),
        })}
      {breadcrumb?.message &&
        getBreadcrumbCustomRendererValue({
          value: breadcrumb.message,
          meta: getMeta(breadcrumb, 'message'),
        })}
    </BreadcrumbDataSummary>
  );
};

export default BreadcrumbDataException;
