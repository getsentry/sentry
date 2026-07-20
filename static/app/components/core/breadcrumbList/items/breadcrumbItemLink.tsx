import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {trackAnalytics} from 'sentry/utils/analytics';

import {BreadcrumbLeadingSlot} from './breadcrumbLeadingSlot';

export interface BreadcrumbItemLinkProps {
  label: string;
  to: LinkProps['to'];
  /**
   * Decorative 16×16 leading graphic — a `ProjectsSavedBadge`, avatar, or icon.
   * Rendered aria-hidden inside a fixed-size slot; the label carries the meaning.
   */
  leadingGraphic?: React.ReactNode;
}

export function BreadcrumbItemLink({label, to, leadingGraphic}: BreadcrumbItemLinkProps) {
  function handleClick() {
    trackAnalytics('breadcrumbs.link.clicked', {organization: null});
  }

  return (
    <Flex as="span" align="center" gap="sm" height="32px" minWidth="32px">
      {leadingGraphic && <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>}
      {/* The visible-width floor lives on the outer Flex above (min-width: 32px).
            Here the label just fills that floored space and ellipsizes within it. */}
      <Container minWidth={0}>
        {styleProps => (
          <Link to={to} onClick={handleClick} {...styleProps}>
            <Text ellipsis variant="muted">
              {label}
            </Text>
          </Link>
        )}
      </Container>
    </Flex>
  );
}
