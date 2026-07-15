import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BreadcrumbLeadingSlot} from 'sentry/components/breadcrumbList/items/breadcrumbLeadingSlot';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';

export interface BreadcrumbItemLinkProps {
  label: string;
  to: LinkProps['to'];
  /** Renders a tooltip showing the full label — useful when text is truncated. Defaults to true. */
  labelTooltip?: boolean;
  /**
   * Decorative 16×16 leading graphic — a `ProjectsSavedBadge`, avatar, or icon.
   * Rendered aria-hidden inside a fixed-size slot; the label carries the meaning.
   */
  leadingGraphic?: React.ReactNode;
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
              ...(typeof to === 'object' && 'query' in to ? to.query : {}),
            },
          }
      : to;

  return (
    <Flex as="span" align="center" gap="sm" height="32px" minWidth="32px">
      {leadingGraphic && <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>}
      {/* style={{minWidth: 0}} unblocks the Tooltip's wrapper <span> (a flex item
          whose default min-width:auto would otherwise refuse to shrink). */}
      <Tooltip title={label} disabled={!labelTooltip} style={{minWidth: 0}}>
        {/* The visible-width floor lives on the outer Flex above (min-width: 32px).
            Here the label just fills that floored space and ellipsizes within it. */}
        <Container minWidth={0}>
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
