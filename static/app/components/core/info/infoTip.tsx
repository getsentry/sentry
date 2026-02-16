import styled from '@emotion/styled';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {IconQuestion} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

interface InfoTooltipProps extends SVGIconProps {
  title: React.ReactNode;
  position?: TooltipProps['position'];
}

export function InfoTip({title, position, ...props}: InfoTooltipProps) {
  return (
    <Tooltip title={title} skipWrapper isHoverable position={position}>
      <StyledIconQuestion
        {...props}
        tabIndex={0}
        role="img"
        aria-label={t('More information')}
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
