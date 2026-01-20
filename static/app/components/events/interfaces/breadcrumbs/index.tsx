import pick from 'lodash/pick';

import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import type {BreadcrumbWithMeta} from './types';

export enum BreadcrumbSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
}

export const BREADCRUMB_SORT_LOCALSTORAGE_KEY = 'event-breadcrumb-sort';

export const BREADCRUMB_SORT_OPTIONS = [
  {label: t('Newest'), value: BreadcrumbSort.NEWEST},
  {label: t('Oldest'), value: BreadcrumbSort.OLDEST},
];

type BreadcrumbListType = BreadcrumbWithMeta | EnhancedCrumb;

export function applyBreadcrumbSearch<T extends BreadcrumbListType>(
  breadcrumbs: T[],
  newSearchTerm: string
): T[] {
  if (!newSearchTerm.trim()) {
    return breadcrumbs;
  }

  // Slightly hacky, but it works
  // the string is being `stringify`d here in order to match exactly the same `stringify`d string of the loop
  const searchFor = JSON.stringify(newSearchTerm)
    // it replaces double backslash generate by JSON.stringify with single backslash
    .replace(/((^")|("$))/g, '')
    .toLocaleLowerCase();

  return breadcrumbs.filter(({breadcrumb}) =>
    Object.keys(
      pick(breadcrumb, ['type', 'category', 'message', 'level', 'timestamp', 'data'])
    ).some(key => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const info = breadcrumb[key];

      if (!defined(info) || !String(info).trim()) {
        return false;
      }

      return JSON.stringify(info)
        .replace(/((^")|("$))/g, '')
        .toLocaleLowerCase()
        .trim()
        .includes(searchFor);
    })
  );
}
