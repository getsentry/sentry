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
 * The old `<Breadcrumbs crumbs={[...]} />` signature continues to work unchanged,
 * including crumbs whose `label` is arbitrary React content (e.g. an editable
 * name field). Migrate call sites to `BreadcrumbList` when making changes in
 * those files — but note the new API only accepts string labels.
 */
import {Fragment} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {IconSlashForward} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';

// The new typed API. Individual item components and their prop types are
// implementation details of `BreadcrumbList` and are intentionally not
// re-exported until a consumer needs them — re-export them here when migrating
// a call site to the typed API.
export {BreadcrumbList} from './breadcrumbList';
/** @public Consumed once call sites migrate onto the typed API in a downstream PR. */
export type {BreadcrumbItem, BreadcrumbListProps} from './breadcrumbList';

// ── Legacy compatibility shim ─────────────────────────────────────────────────
// Preserves the old `Breadcrumbs` + `Crumb` API so existing call sites need no
// changes. Unlike the new `BreadcrumbList`, this renders each crumb's `label`
// as-is, so callers passing React nodes (editable titles, badges, …) keep
// working. New code should prefer the typed `BreadcrumbList` API above.

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

  return (
    <Flex
      as="nav"
      aria-label={t('Breadcrumbs')}
      gap="xs"
      align="center"
      padding="md 0"
      data-test-id="breadcrumb-list"
      {...props}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={index}>
            <BreadcrumbItem
              crumb={{...crumb, to: isLast ? undefined : crumb.to}}
              variant={isLast ? 'primary' : 'muted'}
            />
            {isLast ? null : (
              <Flex as="span" align="center" justify="center" flexShrink={0} aria-hidden>
                <IconSlashForward size="xs" variant="muted" aria-hidden />
              </Flex>
            )}
          </Fragment>
        );
      })}
    </Flex>
  );
}

interface BreadcrumbItemProps {
  crumb: Crumb;
  variant: 'primary' | 'muted';
}

function BreadcrumbItem({crumb, variant}: BreadcrumbItemProps) {
  return (
    <Container maxWidth="400px" width="auto">
      {styleProps =>
        crumb.to ? (
          <BreadcrumbLink
            to={crumb.to}
            preservePageFilters={crumb.preservePageFilters}
            data-test-id="breadcrumb-link"
            onClick={() =>
              trackAnalytics('breadcrumbs.link.clicked', {organization: null})
            }
            {...styleProps}
          >
            <Text ellipsis variant={variant}>
              {crumb.label}
            </Text>
          </BreadcrumbLink>
        ) : (
          <Text ellipsis variant={variant} data-test-id="breadcrumb-item" {...styleProps}>
            {crumb.label}
          </Text>
        )
      }
    </Container>
  );
}

interface BreadcrumbLinkProps extends LinkProps {
  children?: React.ReactNode;
  preservePageFilters?: boolean;
}

function BreadcrumbLink({preservePageFilters, to, ...rest}: BreadcrumbLinkProps) {
  const location = useLocation();

  if (!to) {
    return <Link to={to} {...rest} />;
  }

  const toWithQuery = preservePageFilters
    ? typeof to === 'string'
      ? {pathname: to, query: extractSelectionParameters(location.query)}
      : {...to, query: {...extractSelectionParameters(location.query), ...to.query}}
    : to;

  return <Link to={toWithQuery} {...rest} />;
}
