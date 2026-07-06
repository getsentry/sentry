/**
 * Page breadcrumbs — not to be confused with Sentry's event breadcrumbs.
 *
 * ## New API (preferred)
 * Use `BreadcrumbList` with explicit typed items:
 *
 *   <BreadcrumbList
 *     items={[
 *       {type: 'link', props: {label: 'Discover', to: '/discover/'}},
 *       {type: 'page-title', props: {label: 'My Query'}},
 *     ]}
 *   />
 *
 * ## Legacy API (compatibility shim)
 * The old `<Breadcrumbs crumbs={[...]} />` signature continues to work unchanged.
 * All non-last crumbs become `type: 'link'`; the last crumb becomes `type: 'page-title'`.
 * Migrate call sites to `BreadcrumbList` when making changes in those files.
 */

export {BreadcrumbList} from './breadcrumbList';
export type {BreadcrumbItem, BreadcrumbListProps} from './breadcrumbList';

export {BreadcrumbItemLink} from './items/breadcrumbItemLink';
export type {BreadcrumbItemLinkProps} from './items/breadcrumbItemLink';

export {BreadcrumbItemPageTitle} from './items/breadcrumbItemPageTitle';
export type {
  BreadcrumbItemPaginationProps,
  BreadcrumbItemPageTitleProps,
  BreadcrumbPaginationItem,
} from './items/breadcrumbItemPageTitle';

export {BreadcrumbItemSelectProjects} from './items/breadcrumbItemSelectProjects';
export type {BreadcrumbItemSelectProjectsProps} from './items/breadcrumbItemSelectProjects';

// ── Legacy compatibility shim ─────────────────────────────────────────────────
// Preserves the old `Breadcrumbs` + `Crumb` API so existing call sites need no
// changes. Maps the flat crumbs array to `BreadcrumbList` typed items.

import type {LinkProps} from '@sentry/scraps/link';

import type {BreadcrumbItem} from './breadcrumbList';
import {BreadcrumbList} from './breadcrumbList';

export interface Crumb {
  label: NonNullable<React.ReactNode>;
  preservePageFilters?: boolean;
  to?: LinkProps['to'] | null;
}

interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  crumbs: Crumb[];
}

/**
 * @deprecated Use `BreadcrumbList` with typed items instead.
 */
export function Breadcrumbs({crumbs, ...props}: BreadcrumbsProps) {
  if (crumbs.length === 0) {
    return null;
  }

  const items: BreadcrumbItem[] = crumbs.map((crumb, index) => {
    const isLast = index === crumbs.length - 1;
    // The new API requires string labels (used for tooltip text).
    // Non-string labels from the legacy API are coerced to empty string;
    // callers passing React nodes should migrate to the new BreadcrumbList API.
    const label = typeof crumb.label === 'string' ? crumb.label : '';

    if (isLast) {
      return {
        props: {label},
        type: 'page-title',
      };
    }

    return {
      props: {
        label,
        preservePageFilters: crumb.preservePageFilters,
        to: crumb.to ?? '/',
      },
      type: 'link',
    };
  });

  return <BreadcrumbList items={items} {...props} />;
}
