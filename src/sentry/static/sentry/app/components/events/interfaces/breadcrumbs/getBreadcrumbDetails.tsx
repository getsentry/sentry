import React from 'react';

import {Color} from 'app/utils/theme';
import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';
import {IconInfo} from 'app/icons/iconInfo';
import {IconWarning} from 'app/icons/iconWarning';
import {IconLocation} from 'app/icons/iconLocation';
import {IconUser} from 'app/icons/iconUser';
import {IconRefresh} from 'app/icons/iconRefresh';

import {Breadcrumb} from './types';

type Output = {
  color: Color;
  borderColor: Color;
  icon: React.ReactElement;
  renderer: React.ReactElement;
};

function getBreadcrumbDetails(breadcrumb: Breadcrumb): Partial<Output> {
  switch (breadcrumb.type) {
    case 'user':
    case 'ui': {
      return {
        color: 'purple',
        icon: <IconUser />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case 'navigation': {
      return {
        color: 'blue',
        icon: <IconLocation />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case 'info': {
      return {
        color: 'blue',
        icon: <IconInfo />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case 'warning': {
      return {
        color: 'yellowOrange',
        borderColor: 'yellowOrangeDark',
        icon: <IconWarning />,
        renderer: <ErrorRenderer breadcrumb={breadcrumb} />,
      };
    }
    case 'exception':
    case 'message':
    case 'error': {
      return {
        color: 'red',
        icon: <IconWarning />,
        renderer: <ErrorRenderer breadcrumb={breadcrumb} />,
      };
    }
    case 'http': {
      return {
        color: 'green',
        icon: <IconRefresh />,
        renderer: <HttpRenderer breadcrumb={breadcrumb} />,
      };
    }
    default:
      return {
        icon: <span className="icon-console" />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
  }
}

export default getBreadcrumbDetails;
