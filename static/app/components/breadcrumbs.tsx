import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Chevron} from 'sentry/components/chevron';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import type {LinkProps} from 'sentry/components/links/link';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import type {BreadcrumbDropdownProps} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import BreadcrumbDropdown from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';

const BreadcrumbList = styled('nav')`
  display: flex;
  align-items: center;
  padding: ${space(1)} 0;
`;

export interface Crumb {
  /**
   * Label of the crumb
   */
  label: React.ReactNode;

  /**
   * Component will try to come up with unique key, but you can provide your own
   * (used when mapping over crumbs)
   */
  key?: string;

  /**
   * It will keep the page filter values (projects, environments, time) in the
   * querystring when navigating (GlobalSelectionLink)
   */
  preservePageFilters?: boolean;

  /**
   * Link of the crumb
   */
  to?: LinkProps['to'] | null;
}

export interface CrumbDropdown {
  /**
   * Items of the crumb dropdown
   */
  items: BreadcrumbDropdownProps['items'];

  /**
   * Name of the crumb
   */
  label: React.ReactNode;

  /**
   * Callback function for when an item is selected
   */
  onSelect: BreadcrumbDropdownProps['onSelect'];
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Array of crumbs that will be rendered
   */
  crumbs: Array<Crumb | CrumbDropdown>;

  /**
   * As a general rule of thumb we don't want the last item to be link as it most likely
   * points to the same page we are currently on. This is by default false, so that
   * people don't have to check if crumb is last in the array and then manually
   * assign `to: null/undefined` when passing props to this component.
   */
  linkLastItem?: boolean;
}

function isCrumbDropdown(crumb: Crumb | CrumbDropdown): crumb is CrumbDropdown {
  return (crumb as CrumbDropdown).items !== undefined;
}

/**
 * Page breadcrumbs used for navigation, not to be confused with sentry's event breadcrumbs
 */
export function Breadcrumbs({crumbs, linkLastItem = false, ...props}: Props) {
  if (crumbs.length === 0) {
    return null;
  }

  if (!linkLastItem) {
    const lastCrumb = crumbs[crumbs.length - 1]!;
    if (!isCrumbDropdown(lastCrumb)) {
      lastCrumb.to = null;
    }
  }

  return (
    <BreadcrumbList {...props}>
      {crumbs.map((crumb, index) => {
        if (isCrumbDropdown(crumb)) {
          const {label, ...crumbProps} = crumb;
          return (
            <BreadcrumbDropdown
              key={index}
              isLast={index >= crumbs.length - 1}
              route={{}}
              name={label}
              {...crumbProps}
            />
          );
        }
        const {label, to, preservePageFilters, key} = crumb;
        const labelKey = typeof label === 'string' ? label : '';
        const mapKey =
          key ?? typeof to === 'string' ? `${labelKey}${to}` : `${labelKey}${index}`;

        return (
          <Fragment key={mapKey}>
            {to ? (
              <BreadcrumbLink
                to={to}
                preservePageFilters={preservePageFilters}
                data-test-id="breadcrumb-link"
              >
                {label}
              </BreadcrumbLink>
            ) : (
              <BreadcrumbItem>{label}</BreadcrumbItem>
            )}

            {index < crumbs.length - 1 && <BreadcrumbDividerIcon direction="right" />}
          </Fragment>
        );
      })}
    </BreadcrumbList>
  );
}

const getBreadcrumbListItemStyles = (p: {theme: Theme}) => css`
  ${p.theme.overflowEllipsis}
  color: ${p.theme.subText};
  width: auto;

  &:last-child {
    color: ${p.theme.textColor};
  }
`;

interface BreadcrumbLinkProps {
  to: LinkProps['to'];
  children?: React.ReactNode;
  preservePageFilters?: boolean;
}

const BreadcrumbLink = styled(
  ({preservePageFilters, to, ...props}: BreadcrumbLinkProps) =>
    preservePageFilters ? (
      <GlobalSelectionLink to={to} {...props} />
    ) : (
      <Link to={to} {...props} />
    )
)`
  ${getBreadcrumbListItemStyles}

  &:hover,
  &:active {
    color: ${p => p.theme.subText};
  }
`;

const BreadcrumbItem = styled('span')`
  ${getBreadcrumbListItemStyles}
  max-width: 400px;
`;

const BreadcrumbDividerIcon = styled(Chevron)`
  color: ${p => p.theme.subText};
  margin: 0 ${space(0.5)};
  flex-shrink: 0;
`;

// TODO(epurkhiser): Remove once removed from getsentry
const DO_NOT_USE = Breadcrumbs;

export default DO_NOT_USE;
