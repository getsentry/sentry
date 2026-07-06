import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

export interface BreadcrumbPaginationItem {
  ariaLabel: string;
  to: LinkProps['to'];
  disabled?: boolean;
  onClick?: () => void;
  /** Optional tooltip content — useful for rich tooltips like "Learn More" links. */
  tooltip?: React.ReactNode;
}

export interface BreadcrumbItemPaginationProps {
  next: BreadcrumbPaginationItem;
  previous: BreadcrumbPaginationItem;
}

export interface BreadcrumbItemPageTitleProps {
  label: string;
  /** Renders a tooltip showing the full label — useful when text is truncated. Defaults to true. */
  labelTooltip?: boolean;
  leadingGraphic?: React.ReactNode;
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
              icon={<IconChevron direction="left" size="xs" />}
              aria-label={pagination.previous.ariaLabel ?? t('Previous')}
              disabled={pagination.previous.disabled}
              to={pagination.previous.to}
              onClick={pagination.previous.onClick}
            />
          </Tooltip>
          <Tooltip title={pagination.next.tooltip} disabled={!pagination.next.tooltip}>
            <LinkButton
              size="zero"
              variant="transparent"
              icon={<IconChevron direction="right" size="xs" />}
              aria-label={pagination.next.ariaLabel ?? t('Next')}
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
            <Text
              ellipsis
              variant="primary"
              data-test-id="breadcrumb-item"
              bold
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
