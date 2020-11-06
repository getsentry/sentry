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
        color: 'purple300',
        icon: IconUser,
        description: t('User Action'),
      };

    case BreadcrumbType.NAVIGATION:
      return {
        color: 'green300',
        icon: IconLocation,
        description: t('Navigation'),
      };

    case BreadcrumbType.DEBUG:
      return {
        color: 'purple300',
        icon: IconFix,
        description: t('Debug'),
      };

    case BreadcrumbType.INFO:
      return {
        color: 'blue300',
        icon: IconInfo,
        description: t('Info'),
      };

    case BreadcrumbType.ERROR:
      return {
        color: 'red300',
        icon: IconFire,
        description: t('Error'),
      };

    case BreadcrumbType.HTTP:
      return {
        color: 'green300',
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
        color: 'blue300',
        icon: IconStack,
        description: t('Query'),
      };
    case BreadcrumbType.SYSTEM:
      return {
        color: 'pink200',
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
        color: 'pink300',
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
