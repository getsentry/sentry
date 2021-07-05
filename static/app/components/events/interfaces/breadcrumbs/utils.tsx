import {
  IconFire,
  IconFix,
  IconInfo,
  IconLocation,
  IconMobile,
  IconRefresh,
  IconSpan,
  IconStack,
  IconSwitch,
  IconTerminal,
  IconUser,
  IconWarning,
} from 'app/icons';
import {t} from 'app/locale';
import {Breadcrumb, BreadcrumbLevelType, BreadcrumbType} from 'app/types/breadcrumbs';
import {defined} from 'app/utils';

function convertCrumbType(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.type === BreadcrumbType.EXCEPTION) {
    return {
      ...breadcrumb,
      type: BreadcrumbType.ERROR,
    };
  }
  // special case for 'ui.' and `sentry.` category breadcrumbs
  // TODO: find a better way to customize UI around non-schema data
  if (breadcrumb.type === BreadcrumbType.DEFAULT && defined(breadcrumb?.category)) {
    const [category, subcategory] = breadcrumb.category.split('.');
    if (category === 'ui') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.UI,
      };
    }

    if (category === 'console') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.DEBUG,
      };
    }

    if (category === 'navigation') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.NAVIGATION,
      };
    }

    if (
      category === 'sentry' &&
      (subcategory === 'transaction' || subcategory === 'event')
    ) {
      return {
        ...breadcrumb,
        type: BreadcrumbType.TRANSACTION,
      };
    }
  }

  if (!Object.values(BreadcrumbType).includes(breadcrumb.type)) {
    return {
      ...breadcrumb,
      type: BreadcrumbType.DEFAULT,
    };
  }

  return breadcrumb;
}

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

export function transformCrumbs(breadcrumbs: Array<Breadcrumb>) {
  return breadcrumbs.map((breadcrumb, index) => {
    const convertedCrumbType = convertCrumbType(breadcrumb);
    const crumbDetails = getCrumbDetails(convertedCrumbType.type);
    return {
      id: index,
      ...convertedCrumbType,
      ...crumbDetails,
      level: convertedCrumbType?.level ?? BreadcrumbLevelType.UNDEFINED,
    };
  });
}
