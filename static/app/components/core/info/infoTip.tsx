import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {IconQuestion} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

interface InfoTooltipProps extends SVGIconProps {
  title: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
}

export function InfoTip({title, size = 'sm'}: InfoTooltipProps) {
  return (
    <Tooltip title={title} skipWrapper isHoverable>
      <StyledIconQuestion
        size={size}
        tabIndex={0}
        role="img"
        aria-label="More information"
      />
    </Tooltip>
  );
}

const StyledIconQuestion = styled(IconQuestion)`
  border-radius: 50%;
  outline: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;
