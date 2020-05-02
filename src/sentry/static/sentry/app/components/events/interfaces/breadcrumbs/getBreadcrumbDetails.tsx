import React from 'react';

import {Color} from 'app/utils/theme';
import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';
import {IconInfo, IconWarning, IconLocation, IconUser, IconRefresh} from 'app/icons';

import {Breadcrumb, BreadcrumbType} from './types';

type Output = {
  color: Color;
  borderColor: Color;
  icon: React.ReactElement;
  renderer: React.ReactElement;
};

function getBreadcrumbDetails(breadcrumb: Breadcrumb): Partial<Output> {
  switch (breadcrumb.type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI: {
      return {
        color: 'purple',
        icon: <IconUser />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.NAVIGATION: {
      return {
        color: 'blue',
        icon: <IconLocation />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.INFO: {
      return {
        color: 'blue',
        icon: <IconInfo />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.WARNING: {
      return {
        color: 'yellowOrange',
        borderColor: 'yellowOrangeDark',
        icon: <IconWarning />,
        renderer: <ErrorRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.EXCEPTION:
    case BreadcrumbType.MESSAGE:
    case BreadcrumbType.ERROR: {
      return {
        color: 'red',
        icon: <IconWarning />,
        renderer: <ErrorRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.HTTP: {
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
