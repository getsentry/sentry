import {Fragment} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {IconSlashForward} from 'sentry/icons';
import {trackAnalytics} from 'sentry/utils/analytics';
import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

export interface Crumb {
  /**
   * Label of the crumb
   */
  label: NonNullable<React.ReactNode>;

  /**
   * If true, renders the link as an external link that opens in a new tab
   */
  openInNewTab?: boolean;

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
        return (
          <Fragment key={index}>
            <BreadCrumbItem
              crumb={{...crumb, to: index === crumbs.length - 1 ? undefined : crumb.to}}
              variant={index === crumbs.length - 1 ? 'primary' : 'muted'}
            />
            {index < crumbs.length - 1 ? (
              <Flex align="center" justify="center" flexShrink={0}>
                <IconSlashForward size="xs" variant="muted" />
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
            openInNewTab={props.crumb.openInNewTab}
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
  openInNewTab?: boolean;
  preservePageFilters?: boolean;
}

function BreadcrumbLink(props: BreadcrumbLinkProps) {
  const {preservePageFilters, openInNewTab, to, ...rest} = props;
  const location = useLocation();

  if (!to) {
    return <Link to={to} {...rest} />;
  }

  const toWithQuery = preservePageFilters
    ? typeof to === 'string'
      ? {pathname: to, query: extractSelectionParameters(location.query)}
      : {...to, query: {...extractSelectionParameters(location.query), ...to.query}}
    : to;

  if (openInNewTab) {
    const normalized = normalizeUrl(toWithQuery);
    const toObject = locationDescriptorToTo(normalized);
    const href =
      typeof toObject === 'string'
        ? toObject
        : `${toObject.pathname ?? ''}${toObject.search ?? ''}${toObject.hash ?? ''}`;
    return <ExternalLink href={href} {...rest} />;
  }

  return <Link to={toWithQuery} {...rest} />;
}
