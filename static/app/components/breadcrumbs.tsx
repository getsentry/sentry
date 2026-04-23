import {Fragment, isValidElement} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {IconSlashForward} from 'sentry/icons';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';

export interface Crumb {
  /**
   * Label of the crumb
   */
  label: NonNullable<React.ReactNode>;

  /**
   * It will keep the page filter values (projects, environments, time) in the
   * querystring when navigating using extractSelectionParameters
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
        const isLast = index === crumbs.length - 1;

        return (
          <Fragment key={index}>
            <BreadCrumbItem
              crumb={{...crumb, to: isLast ? undefined : crumb.to}}
              variant={isLast ? 'primary' : 'muted'}
            />
            {isLast ? null : (
              <Flex align="center" justify="center" flexShrink={0}>
                <IconSlashForward size="xs" variant="muted" />
              </Flex>
            )}
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

  const isCustomLabel = isValidElement(props.crumb.label);

  return (
    <Container maxWidth="400px" width="auto">
      {styleProps => {
        if (isCustomLabel && !props.crumb.to) {
          return (
            <div data-test-id="breadcrumb-item" {...styleProps}>
              {props.crumb.label}
            </div>
          );
        }

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
  const {preservePageFilters, to, ...rest} = props;
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
