import {t} from 'app/locale';
import {
  Breadcrumb,
  BreadcrumbLevelType,
  BreadcrumbsWithDetails,
  BreadcrumbType,
} from 'app/types/breadcrumbs';
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

function getCrumbDescriptionAndColor(
  type: BreadcrumbType
): Pick<BreadcrumbsWithDetails[0], 'color' | 'description'> {
  switch (type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return {
        color: 'purple300',
        description: t('User Action'),
      };

    case BreadcrumbType.NAVIGATION:
      return {
        color: 'green300',
        description: t('Navigation'),
      };

    case BreadcrumbType.DEBUG:
      return {
        color: 'purple300',
        description: t('Debug'),
      };

    case BreadcrumbType.INFO:
      return {
        color: 'blue300',
        description: t('Info'),
      };

    case BreadcrumbType.ERROR:
      return {
        color: 'red300',
        description: t('Error'),
      };

    case BreadcrumbType.HTTP:
      return {
        color: 'green300',
        description: t('HTTP request'),
      };

    case BreadcrumbType.WARNING:
      return {
        color: 'orange400',
        description: t('Warning'),
      };
    case BreadcrumbType.QUERY:
      return {
        color: 'blue300',
        description: t('Query'),
      };
    case BreadcrumbType.SYSTEM:
      return {
        color: 'pink300',
        description: t('System'),
      };
    case BreadcrumbType.SESSION:
      return {
        color: 'orange300',
        description: t('Session'),
      };
    case BreadcrumbType.TRANSACTION:
      return {
        color: 'pink300',
        description: t('Transaction'),
      };
    default:
      return {
        color: 'gray300',
        description: t('Default'),
      };
  }
}

export function transformCrumbs(breadcrumbs: Array<Breadcrumb>): BreadcrumbsWithDetails {
  return breadcrumbs.map((breadcrumb, index) => {
    const convertedCrumbType = convertCrumbType(breadcrumb);
    const {color, description} = getCrumbDescriptionAndColor(convertedCrumbType.type);
    return {
      ...convertedCrumbType,
      id: index,
      color,
      description,
      level: convertedCrumbType.level ?? BreadcrumbLevelType.UNDEFINED,
    };
  });
}
