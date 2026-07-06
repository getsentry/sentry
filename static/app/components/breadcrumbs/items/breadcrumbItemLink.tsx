import {Container, Flex} from '@sentry/scraps/layout';
import type {LeadingGraphicProps} from '@sentry/scraps/leadingGraphic';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';

export interface BreadcrumbItemLinkProps {
  label: string;
  to: LinkProps['to'];
  /** Renders a tooltip showing the full label — useful when text is truncated. Defaults to true. */
  labelTooltip?: boolean;
  leadingGraphic?: React.ReactElement<LeadingGraphicProps>;
  preservePageFilters?: boolean;
}

export function BreadcrumbItemLink({
  label,
  to,
  labelTooltip = true,
  leadingGraphic,
  preservePageFilters,
}: BreadcrumbItemLinkProps) {
  const location = useLocation();

  function handleClick() {
    trackAnalytics('breadcrumbs.link.clicked', {organization: null});
  }

  const toWithQuery =
    preservePageFilters && to
      ? typeof to === 'string'
        ? {pathname: to, query: extractSelectionParameters(location.query)}
        : {
            ...to,
            query: {
              ...extractSelectionParameters(location.query),
              ...(typeof to === 'object' && to !== null && 'query' in to ? to.query : {}),
            },
          }
      : to;

  return (
    <Flex as="span" align="center" gap="sm" maxWidth="160px" height="32px" flexShrink={0}>
      {leadingGraphic}
      <Tooltip title={label} disabled={!labelTooltip}>
        <Container maxWidth="132px" width="auto">
          {styleProps => (
            <Link
              to={toWithQuery}
              onClick={handleClick}
              data-test-id="breadcrumb-link"
              {...styleProps}
            >
              <Text ellipsis variant="muted">
                {label}
              </Text>
            </Link>
          )}
        </Container>
      </Tooltip>
    </Flex>
  );
}
