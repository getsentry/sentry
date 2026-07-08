import {Fragment} from 'react';

import type {ButtonProps, LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import type {LeadingGraphicProps} from '@sentry/scraps/leadingGraphic';
import type {LinkProps} from '@sentry/scraps/link';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {BreadcrumbCopyActionProps} from 'sentry/components/breadcrumbList/actions/breadcrumbCopyAction';
import type {BreadcrumbMenuActionProps} from 'sentry/components/breadcrumbList/actions/breadcrumbMenuAction';
import {IconChevron} from 'sentry/icons';

/**
 * A single trailing action for the page-title crumb. Deliberately bounded to the
 * component's own compound parts (`BreadcrumbList.CopyAction` /
 * `BreadcrumbList.MenuAction`) or a plain `Button`/`LinkButton` — never an
 * arbitrary ReactNode — so the trailing slot stays visually consistent.
 *
 * @public Consumed once call sites migrate onto the typed API in a downstream PR.
 */
export type BreadcrumbTitleAction =
  | React.ReactElement<BreadcrumbCopyActionProps>
  | React.ReactElement<BreadcrumbMenuActionProps>
  | React.ReactElement<ButtonProps | LinkButtonProps>;

/** One action, or a list (falsy entries are dropped so consumers can inline conditionals). */
export type BreadcrumbTitleActions =
  | BreadcrumbTitleAction
  | Array<BreadcrumbTitleAction | false | null>;

/**
 * Normalizes the `trailingActions` prop to a flat, keyed row. Shared by the
 * page-title and editable-title items so both render the slot identically.
 * Returns null when there is nothing to render.
 */
export function renderTrailingActions(trailingActions?: BreadcrumbTitleActions) {
  if (!trailingActions) {
    return null;
  }

  const actions = (
    Array.isArray(trailingActions) ? trailingActions : [trailingActions]
  ).filter(Boolean) as BreadcrumbTitleAction[];

  if (actions.length === 0) {
    return null;
  }

  return (
    <Flex as="span" align="center" gap="xs" flexShrink={0}>
      {actions.map((action, index) => (
        <Fragment key={index}>{action}</Fragment>
      ))}
    </Flex>
  );
}

interface BreadcrumbPaginationItem {
  ariaLabel: string;
  disabled?: boolean;
  onClick?: () => void;
  /** Destination for the chevron. When omitted the chevron renders disabled. */
  to?: LinkProps['to'];
  /** Optional tooltip content — useful for rich tooltips like "Learn More" links. */
  tooltip?: React.ReactNode;
}

interface BreadcrumbItemPaginationProps {
  next: BreadcrumbPaginationItem;
  previous: BreadcrumbPaginationItem;
}

export interface BreadcrumbItemPageTitleProps {
  label: string;
  /**
   * Tooltip shown on the label. `true` (default) shows the full label — useful
   * when text is truncated; `false` disables it; a ReactNode renders an always-on
   * custom tooltip (e.g. an issue short-id).
   */
  labelTooltip?: boolean | React.ReactNode;
  leadingGraphic?: React.ReactElement<LeadingGraphicProps>;
  /** Structured prev/next navigation rendered before the label. */
  pagination?: BreadcrumbItemPaginationProps;
  /** Trailing action slot — bounded to the component's compound parts. */
  trailingActions?: BreadcrumbTitleActions;
}

export function BreadcrumbItemPageTitle({
  label,
  labelTooltip = true,
  leadingGraphic,
  pagination,
  trailingActions,
}: BreadcrumbItemPageTitleProps) {
  // boolean → tooltip shows the label (or is disabled); ReactNode → always-on custom tooltip.
  const tooltipTitle = typeof labelTooltip === 'boolean' ? label : labelTooltip;
  const tooltipDisabled = labelTooltip === false;
  const actions = renderTrailingActions(trailingActions);

  return (
    // The whole crumb is a RevealOnHover root (render-prop form so we keep the
    // inline `as="span"` element) — hover-only trailing actions
    // (`BreadcrumbList.CopyAction` without `alwaysVisible`) reveal on crumb hover.
    <RevealOnHover>
      {({className}) => (
        <Flex
          as="span"
          className={className}
          align="center"
          gap="sm"
          height="32px"
          minWidth="32px"
          flexShrink={1}
        >
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
                  disabled={pagination.previous.disabled || !pagination.previous.to}
                  to={pagination.previous.to ?? ''}
                  onClick={pagination.previous.onClick}
                />
              </Tooltip>
              <Tooltip
                title={pagination.next.tooltip}
                disabled={!pagination.next.tooltip}
              >
                <LinkButton
                  size="zero"
                  variant="transparent"
                  icon={<IconChevron direction="right" size="xs" aria-hidden />}
                  aria-label={pagination.next.ariaLabel}
                  disabled={pagination.next.disabled || !pagination.next.to}
                  to={pagination.next.to ?? ''}
                  onClick={pagination.next.onClick}
                />
              </Tooltip>
            </Flex>
          )}
          {leadingGraphic}
          {/* style={{minWidth: 0}} unblocks the Tooltip's wrapper <span> so the
              label can shrink. The visible-width floor lives on the Flex above. */}
          <Tooltip title={tooltipTitle} disabled={tooltipDisabled} style={{minWidth: 0}}>
            <Container minWidth={0} width="auto">
              {styleProps => (
                // Rendered as inline text (a <span>), not a heading: the
                // surrounding context (e.g. the TopBar title <h1>) owns the page
                // heading, so the current-page crumb must be phrasing content
                // that nests cleanly inside it.
                <Text
                  ellipsis
                  bold
                  variant="primary"
                  data-test-id="breadcrumb-item"
                  {...styleProps}
                >
                  {label}
                </Text>
              )}
            </Container>
          </Tooltip>
          {actions}
        </Flex>
      )}
    </RevealOnHover>
  );
}
