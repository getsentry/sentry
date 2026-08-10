import type React from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function OnDemandWarningIcon({
  msg,
  isHoverable,
  variant = 'muted',
}: {
  msg: React.ReactNode;
  isHoverable?: boolean;
  variant?: 'primary' | 'warning' | 'danger' | 'muted';
}) {
  return (
    <Tooltip skipWrapper title={msg} isHoverable={isHoverable}>
      <HoverableIconWarning variant={variant} />
    </Tooltip>
  );
}

const HoverableIconWarning = styled(IconWarning)`
  min-width: ${() => SvgIcon.ICON_SIZES.sm};
  &:hover {
    cursor: pointer;
  }
`;
