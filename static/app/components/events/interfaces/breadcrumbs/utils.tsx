import {t} from 'sentry/locale';
import type {Crumb, RawCrumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils';

/**
 * RawCrumb.type is used for filtering, icons and color. This function converts crumbs
 * that have known categories into better types.
 */
export function convertCrumbType(breadcrumb: RawCrumb): RawCrumb {
  if (breadcrumb.type === BreadcrumbType.EXCEPTION) {
    return {...breadcrumb, type: BreadcrumbType.ERROR};
  }
  const breadcrumbTypeSet = new Set<BreadcrumbType>(Object.values(BreadcrumbType));

  if (breadcrumb.type === BreadcrumbType.DEFAULT && defined(breadcrumb?.category)) {
    const [category, subcategory] = breadcrumb.category.split('.');
    if (breadcrumbTypeSet.has(category as BreadcrumbType)) {
      // XXX: Type hack, instead of manually adding cases for BreadcrumbType.x when BreadcrumbType.x's
      // enum value is the category, we just say it's the default and set it.
      return {...breadcrumb, type: category as BreadcrumbType.DEFAULT};
    }
    switch (category) {
      case 'console':
      case 'Logcat':
        return {...breadcrumb, type: BreadcrumbType.DEBUG};
      case 'session':
        return {...breadcrumb, type: BreadcrumbType.NAVIGATION};
      case 'graphql':
      case 'mutation':
      case 'subscription':
      case 'data_loader':
        return {...breadcrumb, type: BreadcrumbType.QUERY};
      case 'sentry':
        if (subcategory === 'transaction' || subcategory === 'event') {
          return {...breadcrumb, type: BreadcrumbType.TRANSACTION};
        }
        break;
      default:
        break;
    }
  }

  if (!breadcrumbTypeSet.has(breadcrumb.type)) {
    return {...breadcrumb, type: BreadcrumbType.DEFAULT};
  }

  return breadcrumb;
}

export function getCrumbDescriptionAndColor(
  type: BreadcrumbType
): Pick<Crumb, 'color' | 'description'> {
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
        color: 'yellow300',
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
        color: 'pink300',
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

export function transformCrumbs(breadcrumbs: RawCrumb[]): Crumb[] {
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

function moduleToCategory(module: string | null | undefined) {
  if (!module) {
    return undefined;
  }
  const match = module.match(/^.*\/(.*?)(:\d+)/);
  if (!match) {
    return module.split(/./)[0];
  }
  return match[1];
}

export function getVirtualCrumb(event: Event): RawCrumb | undefined {
  const exception = event.entries.find(entry => entry.type === EntryType.EXCEPTION);

  if (!exception && !event.message) {
    return undefined;
  }

  const timestamp = event.dateCreated;

  if (exception) {
    const {type, value, module: mdl} = exception.data.values[0];
    return {
      type: BreadcrumbType.ERROR,
      level: BreadcrumbLevelType.ERROR,
      category: moduleToCategory(mdl) || 'exception',
      data: {
        type,
        value,
      },
      timestamp,
    };
  }

  const levelTag = (event.tags || []).find(tag => tag.key === 'level');

  return {
    type: BreadcrumbType.INFO,
    level: (levelTag?.value as BreadcrumbLevelType) || BreadcrumbLevelType.UNDEFINED,
    category: 'message',
    message: event.message,
    timestamp,
  };
}
