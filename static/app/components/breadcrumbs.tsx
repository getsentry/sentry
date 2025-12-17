import {Fragment} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {LinkProps} from 'sentry/components/core/link';
import {Link} from 'sentry/components/core/link';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconSlashForward} from 'sentry/icons';
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

  return (
    <Flex
      as="nav"
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
              crumb={{...crumb, to: index === crumbs.length - 1 ? undefined : crumb.to}}
              variant={index === crumbs.length - 1 ? 'primary' : 'muted'}
            />
            {index < crumbs.length - 1 ? (
              <Flex align="center" justify="center" flexShrink={0}>
                <IconSlashForward size="xs" color="subText" />
              </Flex>
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

  return (
    <Container maxWidth="400px" width="auto">
      {styleProps => {
        return props.crumb.to ? (
          <BreadcrumbLink
            to={props.crumb.to}
            preservePageFilters={props.crumb.preservePageFilters}
            data-test-id="breadcrumb-link"
            onClick={onBreadcrumbLinkClick}
            {...styleProps}
          >
            <Text ellipsis variant={props.variant}>
              {props.crumb.label}
            </Text>
          </BreadcrumbLink>
        ) : (
          <Text
            ellipsis
            variant={props.variant}
            data-test-id="breadcrumb-item"
            {...styleProps}
          >
            {props.crumb.label}
          </Text>
        );
      }}
    </Container>
  );
}

interface BreadcrumbLinkProps extends LinkProps {
  children?: React.ReactNode;
  preservePageFilters?: boolean;
}

function BreadcrumbLink(props: BreadcrumbLinkProps) {
  const {preservePageFilters, ...rest} = props;
  if (preservePageFilters) {
    return <GlobalSelectionLink {...rest} />;
  }

  return <Link {...rest} />;
}
