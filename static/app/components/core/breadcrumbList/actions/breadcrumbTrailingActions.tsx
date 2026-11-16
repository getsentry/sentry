import {Fragment} from 'react';

import type {FeatureBadgeProps} from '@sentry/scraps/badge';
import type {ButtonProps, LinkButtonProps} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

import type {BreadcrumbCopyActionProps} from './breadcrumbCopyAction';
import {BreadcrumbCopyAction} from './breadcrumbCopyAction';
import type {BreadcrumbMenuActionProps} from './breadcrumbMenuAction';
import {BreadcrumbMenuAction} from './breadcrumbMenuAction';

/**
 * A single trailing action for the page-title or current crumb. The
 * discriminant keeps the supported action shapes type-safe and the trailing
 * slot visually consistent.
 */
type BreadcrumbTrailingAction =
  | ({type: 'copy'} & BreadcrumbCopyActionProps)
  | ({type: 'menu'} & BreadcrumbMenuActionProps)
  | {element: React.ReactElement<FeatureBadgeProps>; type: 'badge'}
  | {element: React.ReactElement<ButtonProps | LinkButtonProps>; type: 'button'};

/**
 * One action, or a list (falsy entries are dropped so consumers can inline conditionals).
 */
export type BreadcrumbTrailingActions =
  | BreadcrumbTrailingAction
  | Array<BreadcrumbTrailingAction | null>;

function renderTrailingAction(action: BreadcrumbTrailingAction) {
  switch (action.type) {
    case 'copy': {
      const {type: _type, ...props} = action;
      return <BreadcrumbCopyAction {...props} />;
    }
    case 'menu': {
      const {type: _type, ...props} = action;
      return <BreadcrumbMenuAction {...props} />;
    }
    case 'badge':
    case 'button':
      return action.element;
    default:
      unreachable(action);
      return null;
  }
}

interface BreadcrumbTrailingActionsProps {
  actions?: BreadcrumbTrailingActions;
}

/**
 * Renders the typed trailing action objects as a flat, keyed row.
 * Renders nothing when there is nothing to render.
 */
export function BreadcrumbTrailingActions({actions}: BreadcrumbTrailingActionsProps) {
  if (!actions) {
    return null;
  }

  // Key on the slot each action was declared in, not its position after the
  // nulls are dropped. Consumers inline conditionals here, so a slot appearing
  // would otherwise shift every later action onto a new key — remounting it and
  // discarding its state (an open dropdown snaps shut).
  const slots = (Array.isArray(actions) ? actions : [actions]).flatMap((action, slot) =>
    action === null ? [] : [{action, slot}]
  );

  if (slots.length === 0) {
    return null;
  }

  return (
    <Flex as="span" align="center" gap="xs" flexShrink={0}>
      {slots.map(({action, slot}) => (
        <Fragment key={slot}>{renderTrailingAction(action)}</Fragment>
      ))}
    </Flex>
  );
}
