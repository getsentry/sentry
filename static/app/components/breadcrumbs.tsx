import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {LinkProps} from 'sentry/components/core/link';
import {Link} from 'sentry/components/core/link';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconChevron} from 'sentry/icons';
import {trackAnalytics} from 'sentry/utils/analytics';

export interface Crumb {
  /**
   * Label of the crumb
   */
  label: NonNullable<React.ReactNode>;

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

interface BreadcrumbsProps extends React.HTMLAttributes<HTMLDivElement> {
  crumbs: Crumb[];
}

/**
 * Page breadcrumbs used for navigation, not to be confused with sentry's event breadcrumbs
 */
export function Breadcrumbs({crumbs, ...props}: BreadcrumbsProps) {
  if (crumbs.length === 0) {
    return null;
  }

  if (crumbs[crumbs.length - 1]?.to) {
    // We should not be mutating the crumbs
    crumbs[crumbs.length - 1]!.to = null;
  }

  return (
    <Flex
      gap="xs"
      align="center"
      padding="md 0"
      data-test-id="breadcrumb-list"
      {...props}
    >
      {crumbs.map((crumb, index) => {
        return (
          <Fragment key={index}>
            <BreadCrumbItem
              crumb={crumb}
              variant={index === crumbs.length - 1 ? 'primary' : 'muted'}
            />
            {index < crumbs.length - 1 ? (
              <IconChevron size="xs" direction="right" color="subText" />
            ) : null}
          </Fragment>
        );
      })}
    </Flex>
  );
}

interface BreadCrumbItemProps {
  crumb: Crumb;
  variant: 'primary' | 'muted';
}

function BreadCrumbItem(props: BreadCrumbItemProps) {
  function onBreadcrumbLinkClick() {
    if (props.crumb.to) {
      trackAnalytics('breadcrumbs.link.clicked', {organization: null});
    }
  }

  if (props.crumb.to) {
    return (
      <BreadcrumbLink
        to={props.crumb.to}
        preservePageFilters={props.crumb.preservePageFilters}
        data-test-id="breadcrumb-link"
        onClick={onBreadcrumbLinkClick}
      >
        <Text variant={props.variant}>{props.crumb.label}</Text>
      </BreadcrumbLink>
    );
  }

  return <Text variant={props.variant}>{props.crumb.label}</Text>;
}

interface BreadcrumbLinkProps extends LinkProps {
  children?: React.ReactNode;
  preservePageFilters?: boolean;
}

function BreadcrumbLink(props: BreadcrumbLinkProps) {
  if (props.preservePageFilters) {
    return <GlobalSelectionLink {...props} />;
  }

  return <Link {...props} />;
}
