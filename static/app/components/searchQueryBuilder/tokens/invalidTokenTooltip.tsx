import type {ReactNode} from 'react';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {Grid} from '@sentry/scraps/layout';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
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
  hasWarning,
  forceVisible,
}: {
  hasWarning: boolean;
  isFocused: boolean;
  isInvalid: boolean;
  forceVisible?: boolean;
}) {
  if (!isInvalid && !hasWarning) {
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
  const warning = 'warning' in token ? token.warning : null;

  const hasWarning = Boolean(warning);
  const isInvalid = Boolean(invalid);
  const isFocused =
    state.selectionManager.isFocused && state.selectionManager.focusedKey === item.key;

  return (
    <Tooltip
      skipWrapper
      forceVisible={getForceVisible({isFocused, isInvalid, hasWarning, forceVisible})}
      position="bottom"
      title={warning ?? invalid?.reason ?? t('This token is invalid')}
      {...tooltipProps}
    >
      {children}
    </Tooltip>
  );
}

type GridInvalidTokenTooltipProps = InvalidTokenTooltipProps & {
  children: React.ReactNode;
  columnCount: number;
};

export function GridInvalidTokenTooltip({
  children,
  columnCount,
  ...props
}: GridInvalidTokenTooltipProps) {
  return (
    <Grid align="stretch" height="22px" columns={`repeat(${columnCount}, auto)`}>
      {styleProps => (
        <InvalidTokenTooltip {...props} {...styleProps}>
          {children}
        </InvalidTokenTooltip>
      )}
    </Grid>
  );
}
