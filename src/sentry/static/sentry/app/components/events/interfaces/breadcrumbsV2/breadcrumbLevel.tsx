import React from 'react';

import Tag from 'app/views/settings/components/tag';

import {BreadcrumbLevelType} from '../breadcrumbs/types';

type Props = {
  level?: BreadcrumbLevelType;
};

const BreadcrumbLevelTag = ({level}: Props) => {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
    case BreadcrumbLevelType.ERROR:
      return <Tag priority="error">{level}</Tag>;
    case BreadcrumbLevelType.INFO:
      return <Tag priority="info">{level}</Tag>;
    case BreadcrumbLevelType.WARNING:
      return <Tag priority="warning">{level}</Tag>;
    default:
      return <Tag>{level}</Tag>;
  }
};

const BreadcrumbLevel = ({level}: Props) => (
  <div>
    <BreadcrumbLevelTag level={level} />
  </div>
);

export default BreadcrumbLevel;
