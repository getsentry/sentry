import React from 'react';

import Tag from 'app/views/settings/components/tag';
import {t} from 'app/locale';

import {BreadcrumbLevelType} from './types';

type Props = {
  level?: BreadcrumbLevelType;
};

const Level = ({level}: Props) => {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
    case BreadcrumbLevelType.ERROR:
      return <Tag priority="error">{level}</Tag>;
    case BreadcrumbLevelType.INFO:
      return <Tag priority="info">{level}</Tag>;
    case BreadcrumbLevelType.WARNING:
      return <Tag priority="warning">{level}</Tag>;
    default:
      return <Tag>{level || t('undefined')}</Tag>;
  }
};

export {Level};
