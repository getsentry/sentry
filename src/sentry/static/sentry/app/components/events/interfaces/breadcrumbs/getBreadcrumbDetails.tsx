import React from 'react';

import {Color} from 'app/utils/theme';
import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';
import {
  IconInfo,
  IconLocation,
  IconRefresh,
  IconTerminal,
  IconUser,
  IconWarning,
} from 'app/icons';

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
        color: 'blue400',
        icon: <IconLocation />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.INFO: {
      return {
        color: 'blue400',
        icon: <IconInfo />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
    }
    case BreadcrumbType.WARNING: {
      return {
        color: 'orange300',
        borderColor: 'orange500',
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
        color: 'green400',
        icon: <IconRefresh />,
        renderer: <HttpRenderer breadcrumb={breadcrumb} />,
      };
    }
    default:
      return {
        icon: <IconTerminal />,
        renderer: <DefaultRenderer breadcrumb={breadcrumb} />,
      };
  }
}

export default getBreadcrumbDetails;
