import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {IconInfo} from 'sentry/icons';

interface InfoTooltipProps {
  title: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
}

export function InfoTip({title, size = 'sm'}: InfoTooltipProps) {
  return (
    <Tooltip title={title} skipWrapper isHoverable>
      <StyledIconInfo size={size} tabIndex={0} role="img" aria-label="More information" />
    </Tooltip>
  );
}

const StyledIconInfo = styled(IconInfo)`
  border-radius: 50%;
  cursor: help;
  outline: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;
