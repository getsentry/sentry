import {Fragment} from 'react';

import {BreadcrumbCopyAction} from '@sentry/scraps/breadcrumbList/actions/breadcrumbCopyAction';
import type {BreadcrumbCopyActionProps} from '@sentry/scraps/breadcrumbList/actions/breadcrumbCopyAction';
import {BreadcrumbMenuAction} from '@sentry/scraps/breadcrumbList/actions/breadcrumbMenuAction';
import type {BreadcrumbMenuActionProps} from '@sentry/scraps/breadcrumbList/actions/breadcrumbMenuAction';
import {Button, type ButtonProps, type LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconChevron} from 'sentry/icons';
import {unreachable} from 'sentry/utils/unreachable';

import {BreadcrumbLeadingSlot} from './breadcrumbLeadingSlot';

/**
 * A single trailing action for the page-title crumb. The discriminant keeps
 * the supported action shapes type-safe and the trailing slot visually
 * consistent.
 */
type BreadcrumbTitleAction =
  | ({type: 'copy'} & BreadcrumbCopyActionProps)
  | ({type: 'menu'} & BreadcrumbMenuActionProps)
  | {element: React.ReactElement<ButtonProps | LinkButtonProps>; type: 'button'};

/**
 * One action, or a list (falsy entries are dropped so consumers can inline conditionals).
 */
type BreadcrumbTitleActions = BreadcrumbTitleAction | Array<BreadcrumbTitleAction | null>;

/**
 * Renders the typed trailing action objects as a flat, keyed row.
 * Returns null when there is nothing to render.
 */
function renderTrailingAction(action: BreadcrumbTitleAction) {
  switch (action.type) {
    case 'copy': {
      const {type: _type, ...props} = action;
      return <BreadcrumbCopyAction {...props} />;
    }
    case 'menu': {
      const {type: _type, ...props} = action;
      return <BreadcrumbMenuAction {...props} />;
    }
    case 'button':
      return action.element;
    default:
      unreachable(action);
      return null;
  }
}

function renderTrailingActions(trailingActions?: BreadcrumbTitleActions) {
  if (!trailingActions) {
    return null;
  }

  const actions = (
    Array.isArray(trailingActions) ? trailingActions : [trailingActions]
  ).filter(action => action !== null);

  if (actions.length === 0) {
    return null;
  }

  return (
    <Flex as="span" align="center" gap="xs" flexShrink={0}>
      {actions.map((action, index) => (
        <Fragment key={index}>{renderTrailingAction(action)}</Fragment>
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
   * Tooltip shown on the label. renders an always-on custom tooltip (e.g. an issue short-id).
   */
  labelTooltip?: React.ReactNode;
  /**
   * Decorative 16×16 leading graphic — a `ProjectsSavedBadge`, avatar, or icon.
   * Rendered aria-hidden inside a fixed-size slot; the label carries the meaning.
   */
  leadingGraphic?: React.ReactNode;
  /** Structured prev/next navigation rendered before the label. */
  pagination?: BreadcrumbItemPaginationProps;
  /** Typed trailing actions rendered after the page title. */
  trailingActions?: BreadcrumbTitleActions;
}

export function BreadcrumbItemPageTitle({
  label,
  labelTooltip,
  leadingGraphic,
  pagination,
  trailingActions,
}: BreadcrumbItemPageTitleProps) {
  const actions = renderTrailingActions(trailingActions);

  return (
    <Flex as="span" align="center" gap="sm" height="32px" minWidth="32px">
      {pagination && (
        <Flex as="span" align="center">
          <Tooltip
            title={pagination.previous.tooltip}
            disabled={!pagination.previous.tooltip}
          >
            {pagination.previous.to ? (
              <LinkButton
                size="zero"
                variant="transparent"
                icon={<IconChevron direction="left" size="xs" aria-hidden />}
                aria-label={pagination.previous.ariaLabel}
                disabled={pagination.previous.disabled}
                to={pagination.previous.to}
                onClick={pagination.previous.onClick}
              />
            ) : (
              <Button
                size="zero"
                variant="transparent"
                icon={<IconChevron direction="left" size="xs" aria-hidden />}
                aria-label={pagination.previous.ariaLabel}
                disabled
              />
            )}
          </Tooltip>
          <Tooltip title={pagination.next.tooltip} disabled={!pagination.next.tooltip}>
            {pagination.next.to ? (
              <LinkButton
                size="zero"
                variant="transparent"
                icon={<IconChevron direction="right" size="xs" aria-hidden />}
                aria-label={pagination.next.ariaLabel}
                disabled={pagination.next.disabled}
                to={pagination.next.to}
                onClick={pagination.next.onClick}
              />
            ) : (
              <Button
                size="zero"
                variant="transparent"
                icon={<IconChevron direction="right" size="xs" aria-hidden />}
                aria-label={pagination.next.ariaLabel}
                disabled
              />
            )}
          </Tooltip>
        </Flex>
      )}
      {leadingGraphic && <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>}
      {/* minWidth={0} lets the title content shrink. The visible-width floor lives
          on the outer Flex above. */}
      <Container minWidth={0}>
        {containerProps => (
          <InfoText
            title={labelTooltip}
            ellipsis
            bold
            variant="inherit"
            {...containerProps}
          >
            {label}
          </InfoText>
        )}
      </Container>
      {actions}
    </Flex>
  );
}
