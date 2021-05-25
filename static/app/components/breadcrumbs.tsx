import * as React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Link from 'app/components/links/link';
import {IconChevron} from 'app/icons';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';
import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';

const BreadcrumbList = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} 0;
`;

export type Crumb = {
  /**
   * Label of the crumb
   */
  label: React.ReactNode;

  /**
   * Link of the crumb
   */
  to?: React.ComponentProps<typeof Link>['to'] | null;

  /**
   * It will keep the global selection values (projects, environments, time) in the
   * querystring when navigating (GlobalSelectionLink)
   */
  preserveGlobalSelection?: boolean;

  /**
   * Component will try to come up with unique key, but you can provide your own
   * (used when mapping over crumbs)
   */
  key?: string;
};

export type CrumbDropdown = {
  /**
   * Name of the crumb
   */
  label: React.ReactNode;

  /**
   * Items of the crumb dropdown
   */
  items: React.ComponentProps<typeof BreadcrumbDropdown>['items'];

  /**
   * Callback function for when an item is selected
   */
  onSelect: React.ComponentProps<typeof BreadcrumbDropdown>['onSelect'];
};

type Props = React.ComponentPropsWithoutRef<typeof BreadcrumbList> & {
  /**
   * Array of crumbs that will be rendered
   */
  crumbs: (Crumb | CrumbDropdown)[];

  /**
   * As a general rule of thumb we don't want the last item to be link as it most likely
   * points to the same page we are currently on. This is by default false, so that
   * people don't have to check if crumb is last in the array and then manually
   * assign `to: null/undefined` when passing props to this component.
   */
  linkLastItem?: boolean;
};

function isCrumbDropdown(crumb: Crumb | CrumbDropdown): crumb is CrumbDropdown {
  return (crumb as CrumbDropdown).items !== undefined;
}

/**
 * Page breadcrumbs used for navigation, not to be confused with sentry's event breadcrumbs
 */
const Breadcrumbs = ({crumbs, linkLastItem = false, ...props}: Props) => {
  if (crumbs.length === 0) {
    return null;
  }

  if (!linkLastItem) {
    const lastCrumb = crumbs[crumbs.length - 1];
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
        } else {
          const {label, to, preserveGlobalSelection, key} = crumb;
          const labelKey = typeof label === 'string' ? label : '';
          const mapKey =
            key ?? typeof to === 'string' ? `${labelKey}${to}` : `${labelKey}${index}`;

          return (
            <React.Fragment key={mapKey}>
              {to ? (
                <BreadcrumbLink to={to} preserveGlobalSelection={preserveGlobalSelection}>
                  {label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbItem>{label}</BreadcrumbItem>
              )}

              {index < crumbs.length - 1 && (
                <BreadcrumbDividerIcon size="xs" direction="right" />
              )}
            </React.Fragment>
          );
        }
      })}
    </BreadcrumbList>
  );
};

const getBreadcrumbListItemStyles = (p: {theme: Theme}) => `
  color: ${p.theme.gray300};
  ${overflowEllipsis};
  width: auto;

  &:last-child {
    color: ${p.theme.textColor};
  }
`;

type BreadcrumbLinkProps = {
  to: React.ComponentProps<typeof Link>['to'];
  preserveGlobalSelection?: boolean;
  children?: React.ReactNode;
};

const BreadcrumbLink = styled(
  ({preserveGlobalSelection, to, ...props}: BreadcrumbLinkProps) =>
    preserveGlobalSelection ? (
      <GlobalSelectionLink to={to as LocationDescriptor} {...props} />
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

const BreadcrumbDividerIcon = styled(IconChevron)`
  color: ${p => p.theme.gray300};
  margin: 0 ${space(1)};
  flex-shrink: 0;
`;

export default Breadcrumbs;
