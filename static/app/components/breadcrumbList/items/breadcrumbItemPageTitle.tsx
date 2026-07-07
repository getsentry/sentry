import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import type {LeadingGraphicProps} from '@sentry/scraps/leadingGraphic';
import type {LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconChevron} from 'sentry/icons';

interface BreadcrumbPaginationItem {
  ariaLabel: string;
  to: LinkProps['to'];
  disabled?: boolean;
  onClick?: () => void;
  /** Optional tooltip content — useful for rich tooltips like "Learn More" links. */
  tooltip?: React.ReactNode;
}

interface BreadcrumbItemPaginationProps {
  next: BreadcrumbPaginationItem;
  previous: BreadcrumbPaginationItem;
}

export interface BreadcrumbItemPageTitleProps {
  label: string;
  /** Renders a tooltip showing the full label — useful when text is truncated. Defaults to true. */
  labelTooltip?: boolean;
  leadingGraphic?: React.ReactElement<LeadingGraphicProps>;
  /** Structured prev/next navigation rendered before the label. */
  pagination?: BreadcrumbItemPaginationProps;
  /** Trailing action slot (up to 52px wide). */
  trailingActions?: React.ReactNode;
}

export function BreadcrumbItemPageTitle({
  label,
  labelTooltip = true,
  leadingGraphic,
  pagination,
  trailingActions,
}: BreadcrumbItemPageTitleProps) {
  return (
    <Flex as="span" align="center" gap="sm" height="32px" flexShrink={0}>
      {pagination && (
        <Flex as="span" align="center">
          <Tooltip
            title={pagination.previous.tooltip}
            disabled={!pagination.previous.tooltip}
          >
            <LinkButton
              size="zero"
              variant="transparent"
              icon={<IconChevron direction="left" size="xs" aria-hidden />}
              aria-label={pagination.previous.ariaLabel}
              disabled={pagination.previous.disabled}
              to={pagination.previous.to}
              onClick={pagination.previous.onClick}
            />
          </Tooltip>
          <Tooltip title={pagination.next.tooltip} disabled={!pagination.next.tooltip}>
            <LinkButton
              size="zero"
              variant="transparent"
              icon={<IconChevron direction="right" size="xs" aria-hidden />}
              aria-label={pagination.next.ariaLabel}
              disabled={pagination.next.disabled}
              to={pagination.next.to}
              onClick={pagination.next.onClick}
            />
          </Tooltip>
        </Flex>
      )}
      {leadingGraphic}
      <Tooltip title={label} disabled={!labelTooltip}>
        <Container maxWidth="200px" width="auto">
          {styleProps => (
            // Rendered as inline text (a <span>), not a heading: the surrounding
            // context (e.g. the TopBar title <h1>) owns the page heading, so the
            // current-page crumb must be phrasing content that nests cleanly
            // inside it. Mirrors the legacy breadcrumb's current-crumb rendering.
            <Text
              ellipsis
              variant="primary"
              data-test-id="breadcrumb-item"
              {...styleProps}
            >
              {label}
            </Text>
          )}
        </Container>
      </Tooltip>
      {trailingActions && (
        <Container maxWidth="52px" flexShrink={0}>
          {trailingActions}
        </Container>
      )}
    </Flex>
  );
}
