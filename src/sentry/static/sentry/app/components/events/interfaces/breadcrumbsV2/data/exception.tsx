import React from 'react';
import omit from 'lodash/omit';

import {defined} from 'app/utils';

import {BreadcrumbTypeDefault} from '../types';
import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
};

const Exception = ({breadcrumb}: Props) => {
  const {data} = breadcrumb;
  const dataValue = data?.value;

  const renderDataValue = () => {
    if (breadcrumb?.message) {
      return `${dataValue}. `;
    }
    return dataValue;
  };

  return (
    <Summary kvData={omit(data, ['type', 'value'])}>
      {data?.type && <strong>{`${data.type}: `}</strong>}
      {defined(dataValue) && renderDataValue()}
      {breadcrumb?.message && breadcrumb.message}
    </Summary>
  );
};

export default Exception;
