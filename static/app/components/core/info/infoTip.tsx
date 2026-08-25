import styled from '@emotion/styled';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconLock, IconQuestion} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

interface InfoTooltipProps extends SVGIconProps {
  title: React.ReactNode;
  position?: TooltipProps['position'];
}

function IconWithTooltip({
  title,
  position,
  icon: Icon,
  'aria-label': ariaLabel,
  ...props
}: InfoTooltipProps & {icon: React.ComponentType<SVGIconProps>}) {
  return (
    <Tooltip title={title} skipWrapper isHoverable position={position}>
      <StyledIconWrapper tabIndex={0} role="img" aria-label={ariaLabel}>
        <Icon {...props} aria-hidden />
      </StyledIconWrapper>
    </Tooltip>
  );
}

const StyledIconWrapper = styled('span')`
  display: inline-flex;
  border-radius: 50%;
  outline: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;

export function InfoTip(props: InfoTooltipProps) {
  const {t} = useTranslation();

  return (
    <IconWithTooltip {...props} icon={IconQuestion} aria-label={t('More information')} />
  );
}

function LockIcon(props: SVGIconProps) {
  return <IconLock locked {...props} />;
}

export function DisabledTip(props: InfoTooltipProps) {
  const {t} = useTranslation();

  return <IconWithTooltip {...props} icon={LockIcon} aria-label={t('Disabled')} />;
}
