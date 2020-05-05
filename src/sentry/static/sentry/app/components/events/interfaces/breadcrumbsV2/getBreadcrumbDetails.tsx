import {
  IconInfo,
  IconWarning,
  IconLocation,
  IconUser,
  IconRefresh,
  IconTerminal,
} from 'app/icons';
import {t} from 'app/locale';

import {BreadcrumbType, BreadcrumbDetails} from '../breadcrumbs/types';

function getBreadcrumbDetails(breadcrumbType: BreadcrumbType): BreadcrumbDetails {
  switch (breadcrumbType) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI: {
      return {
        color: 'purple',
        icon: IconUser,
        description: t('User Action'),
      };
    }
    case BreadcrumbType.NAVIGATION: {
      return {
        color: 'blue',
        icon: IconLocation,
        description: t('Navigation'),
      };
    }
    case BreadcrumbType.INFO: {
      return {
        color: 'blue',
        icon: IconInfo,
        description: t('Info'),
      };
    }
    case BreadcrumbType.WARNING: {
      return {
        color: 'yellowOrange',
        borderColor: 'yellowOrangeDark',
        icon: IconWarning,
        description: t('Warning'),
      };
    }
    case BreadcrumbType.DEBUG: {
      return {
        icon: IconTerminal,
        description: t('Debug'),
      };
    }
    case BreadcrumbType.EXCEPTION:
    case BreadcrumbType.MESSAGE: {
      return {
        color: 'red',
        icon: IconWarning,
        description: t('Error'),
      };
    }
    case BreadcrumbType.HTTP: {
      return {
        color: 'green',
        icon: IconRefresh,
        description: t('HTTP request'),
      };
    }
    default:
      return {
        icon: IconRefresh,
        description: t('Others'),
      };
  }
}

export default getBreadcrumbDetails;
