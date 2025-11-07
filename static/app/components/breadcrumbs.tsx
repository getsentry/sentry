import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Chevron} from 'sentry/components/chevron';
import type {LinkProps} from 'sentry/components/core/link';
import {Link} from 'sentry/components/core/link';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';

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
    crumbs[crumbs.length - 1]!.to = null;
  }

  return (
    <Flex
      gap="xs"
      align="center"
      padding="md 0"
      {...props}
      data-test-id="breadcrumb-list"
    >
      {crumbs.map((crumb, index) => {
        return (
          <Fragment key={index}>
            <BreadCrumbItem
              crumb={crumb}
              variant={index === crumbs.length - 1 ? 'primary' : 'muted'}
            />
            {index < crumbs.length - 1 ? <BreadcumbChevron /> : null}
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
  if (props.crumb.to) {
    return (
      <BreadcrumbLink
        to={props.crumb.to}
        preservePageFilters={props.crumb.preservePageFilters}
        data-test-id="breadcrumb-link"
      >
        <Text as="span" variant="muted">
          {props.crumb.label}
        </Text>
      </BreadcrumbLink>
    );
  }
  return (
    <Flex data-test-id="breadcrumb-item" maxWidth="400px" align="center">
      <Text as="span" ellipsis variant={props.variant}>
        {props.crumb.label}
      </Text>
    </Flex>
  );
}

interface BreadcrumbLinkProps {
  to: LinkProps['to'];
  children?: React.ReactNode;
  preservePageFilters?: boolean;
}

function BreadcrumbLink(props: BreadcrumbLinkProps) {
  if (props.preservePageFilters) {
    return <GlobalSelectionLink {...props} />;
  }
  return <Link {...props} />;
}

function BreadcumbChevron() {
  return (
    <Text variant="muted">
      <Flex flexShrink={0} align="center">
        <Chevron direction="right" color="subText" />
      </Flex>
    </Text>
  );
}
