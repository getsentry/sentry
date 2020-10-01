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
  IconSpan,
} from 'app/icons';
import {t} from 'app/locale';

import {BreadcrumbType} from './types';

function getCrumbDetails(type: BreadcrumbType) {
  switch (type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return {
        color: 'purple400',
        icon: IconUser,
        description: t('User Action'),
      };

    case BreadcrumbType.NAVIGATION:
      return {
        color: 'green500',
        icon: IconLocation,
        description: t('Navigation'),
      };

    case BreadcrumbType.DEBUG:
      return {
        color: 'purple500',
        icon: IconFix,
        description: t('Debug'),
      };

    case BreadcrumbType.INFO:
      return {
        color: 'blue400',
        icon: IconInfo,
        description: t('Info'),
      };

    case BreadcrumbType.ERROR:
      return {
        color: 'red400',
        icon: IconFire,
        description: t('Error'),
      };

    case BreadcrumbType.HTTP:
      return {
        color: 'green400',
        icon: IconSwitch,
        description: t('HTTP request'),
      };

    case BreadcrumbType.WARNING:
      return {
        color: 'orange400',
        icon: IconWarning,
        description: t('Warning'),
      };
    case BreadcrumbType.QUERY:
      return {
        color: 'blue500',
        icon: IconStack,
        description: t('Query'),
      };
    case BreadcrumbType.SYSTEM:
      return {
        color: 'pink300',
        icon: IconMobile,
        description: t('System'),
      };
    case BreadcrumbType.SESSION:
      return {
        color: 'orange500',
        icon: IconRefresh,
        description: t('Session'),
      };
    case BreadcrumbType.TRANSACTION:
      return {
        color: 'pink400',
        icon: IconSpan,
        description: t('Transaction'),
      };
    default:
      return {
        icon: IconTerminal,
        description: t('Default'),
      };
  }
}

export default getCrumbDetails;
