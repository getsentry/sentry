import styled from '@emotion/styled';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translationContext';
import {useIsInsideInteractiveElement} from '@sentry/scraps/useIsInsideInteractiveElement';

import {IconBroadcast} from 'sentry/icons/iconBroadcast';
import {IconBug} from 'sentry/icons/iconBug';
import {IconLab} from 'sentry/icons/iconLab';
import type {TagVariant} from 'sentry/utils/theme';

import {Tag} from './tag';

function useDefaultTitle(type: FeatureBadgeProps['type']) {
  const {t} = useTranslation();
  switch (type) {
    case 'alpha':
      return t('This feature is internal and available for QA purposes');
    case 'beta':
      return t('This feature is in beta and may change');
    case 'new':
      return t('This feature is new! Try it out and let us know what you think');
    case 'experimental':
      return t(
        'This feature is experimental! Try it out and let us know what you think. No promises!'
      );
    case 'debug':
      return t('This UI is for debugging purposes only');
  }
}

const variantMap: Record<FeatureBadgeProps['type'], TagVariant> = {
  alpha: 'promotion',
  beta: 'warning',
  new: 'success',
  experimental: 'muted',
  debug: 'danger',
};

const iconMap: Record<FeatureBadgeProps['type'], React.ReactNode> = {
  alpha: <IconLab isSolid size="xs" aria-hidden />,
  beta: <IconLab isSolid size="xs" aria-hidden />,
  new: <IconBroadcast size="xs" aria-hidden />,
  experimental: <IconLab isSolid size="xs" aria-hidden />,
  debug: <IconBug size="xs" aria-hidden />,
};

export interface FeatureBadgeProps {
  type: 'alpha' | 'beta' | 'new' | 'experimental' | 'debug';
  tooltipProps?: Omit<Partial<TooltipProps>, 'isHoverable' | 'skipWrapper'>;
}

export function FeatureBadge({type, tooltipProps}: FeatureBadgeProps) {
  const defaultTitle = useDefaultTitle(type);
  const title = tooltipProps?.title ?? defaultTitle;

  const {ref, isInsideInteractiveElement, isInteractiveElementFocusVisible} =
    useIsInsideInteractiveElement<HTMLDivElement>(undefined);

  return (
    <Tooltip
      title={title}
      position="right"
      {...tooltipProps}
      isHoverable
      skipWrapper
      forceVisible={
        isInteractiveElementFocusVisible ? 'delayed' : tooltipProps?.forceVisible
      }
    >
      <SquareTag
        tabIndex={isInsideInteractiveElement ? undefined : 0}
        variant={variantMap[type]}
        aria-label={type}
        ref={ref}
      >
        {iconMap[type]}
      </SquareTag>
    </Tooltip>
  );
}

const SquareTag = styled(Tag)`
  width: 20px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;
