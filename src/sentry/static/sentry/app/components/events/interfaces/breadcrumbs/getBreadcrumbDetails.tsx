import {IconInfo} from 'app/icons/iconInfo';
import {IconWarning} from 'app/icons/iconWarning';
import {IconLocation} from 'app/icons/iconLocation';
import {IconUser} from 'app/icons/iconUser';
import {IconRefresh} from 'app/icons/iconRefresh';
import {t} from 'app/locale';

import {BreadcrumbType, BreadcrumbDetails} from './types';

function getBreadcrumbDetails(breadcrumbType: BreadcrumbType): BreadcrumbDetails {
  switch (breadcrumbType) {
    case 'user':
    case 'ui': {
      return {
        color: 'purple',
        icon: IconUser,
        description: t('User Action'),
      };
    }
    case 'navigation': {
      return {
        color: 'blue',
        icon: IconLocation,
        description: t('Navigation'),
      };
    }
    case 'info': {
      return {
        color: 'blue',
        icon: IconInfo,
        description: t('Info'),
      };
    }
    case 'warning': {
      return {
        color: 'yellowOrange',
        borderColor: 'yellowOrangeDark',
        icon: IconWarning,
        description: t('Warning'),
      };
    }
    case 'exception':
    case 'message':
    case 'error': {
      return {
        color: 'red',
        icon: IconWarning,
        description: t('Error'),
      };
    }
    case 'http': {
      return {
        color: 'green',
        icon: IconRefresh,
        description: t('Http request'),
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
