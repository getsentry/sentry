import type {ReactNode} from 'react';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
import {Tooltip, type TooltipProps} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

interface InvalidTokenTooltipProps extends Omit<TooltipProps, 'title'> {
  children: ReactNode;
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: ParseResultToken;
}

function getForceVisible({
  isFocused,
  isInvalid,
  forceVisible,
}: {
  isFocused: boolean;
  isInvalid: boolean;
  forceVisible?: boolean;
}) {
  if (!isInvalid) {
    return false;
  }

  if (defined(forceVisible)) {
    return forceVisible;
  }

  return isFocused ? true : undefined;
}

export function InvalidTokenTooltip({
  children,
  token,
  state,
  item,
  forceVisible,
  ...tooltipProps
}: InvalidTokenTooltipProps) {
  const invalid = 'invalid' in token ? token.invalid : null;
  const isInvalid = Boolean(invalid);
  const isFocused =
    state.selectionManager.isFocused && state.selectionManager.focusedKey === item.key;

  return (
    <Tooltip
      skipWrapper
      forceVisible={getForceVisible({isFocused, isInvalid, forceVisible})}
      position="bottom"
      title={invalid?.reason ?? t('This token is invalid')}
      {...tooltipProps}
    >
      {children}
    </Tooltip>
  );
}
