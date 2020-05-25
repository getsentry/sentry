import {
  IconInfo,
  IconWarning,
  IconLocation,
  IconUser,
  IconRefresh,
  IconFix,
  IconFire,
  IconTerminal,
  IconStack,
  IconMobile,
  IconSwitch,
} from 'app/icons';
import {t} from 'app/locale';

import {BreadcrumbType} from './types';

function getCrumbDetails(type: BreadcrumbType) {
  switch (type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return {
        color: 'purple',
        icon: IconUser,
        description: t('User Action'),
      };

    case BreadcrumbType.NAVIGATION:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#1C8952',
        icon: IconLocation,
        description: t('Navigation'),
      };

    case BreadcrumbType.DEBUG:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#3E2C73',
        icon: IconFix,
        description: t('Debug'),
      };

    case BreadcrumbType.INFO:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#3D74DB',
        icon: IconInfo,
        description: t('Info'),
      };

    case BreadcrumbType.ERROR:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#FA4747',
        icon: IconFire,
        description: t('Error'),
      };

    case BreadcrumbType.HTTP:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#4DC771',
        icon: IconSwitch,
        description: t('HTTP request'),
      };

    case BreadcrumbType.WARNING:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#FF7738',
        icon: IconWarning,
        description: t('Warning'),
      };
    case BreadcrumbType.QUERY:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#194591',
        icon: IconStack,
        description: t('Query'),
      };
    case BreadcrumbType.SYSTEM:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#FF99BC',
        icon: IconMobile,
        description: t('System'),
      };
    case BreadcrumbType.SESSION:
      return {
        // TODO(style): replace the color below, as soon as it is part of the theme
        color: '#BA4A23',
        icon: IconRefresh,
        description: t('Session'),
      };
    default:
      return {
        icon: IconTerminal,
        description: t('Default'),
      };
  }
}

export {getCrumbDetails};
