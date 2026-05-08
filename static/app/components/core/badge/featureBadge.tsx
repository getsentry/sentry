import styled from '@emotion/styled';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {IconBroadcast} from 'sentry/icons/iconBroadcast';
import {IconLab} from 'sentry/icons/iconLab';
import {t} from 'sentry/locale';
import type {TagVariant} from 'sentry/utils/theme';

import {Tag, type TagProps} from './tag';

const defaultTitles: Record<FeatureBadgeProps['type'], string> = {
  alpha: t('This feature is internal and available for QA purposes'),
  beta: t('This feature is available for early adopters and may change'),
  new: t('This feature is new! Try it out and let us know what you think'),
  experimental: t(
    'This feature is experimental! Try it out and let us know what you think. No promises!'
  ),
};

const variantMap: Record<FeatureBadgeProps['type'], TagVariant> = {
  alpha: 'promotion',
  beta: 'warning',
  new: 'success',
  experimental: 'muted',
};

const iconMap: Record<FeatureBadgeProps['type'], React.ReactNode> = {
  alpha: <IconLab isSolid size="xs" />,
  beta: <IconLab isSolid size="xs" />,
  new: <IconBroadcast size="xs" />,
  experimental: <IconLab isSolid size="xs" />,
};

export interface FeatureBadgeProps extends Omit<TagProps, 'children' | 'variant'> {
  type: 'alpha' | 'beta' | 'new' | 'experimental';
  tooltipProps?: Partial<TooltipProps>;
}

export function FeatureBadge({type, tooltipProps, ...props}: FeatureBadgeProps) {
  const title = tooltipProps?.title ?? defaultTitles[type] ?? '';

  return (
    <Tooltip title={title} position="right" {...tooltipProps} skipWrapper>
      <SquareTag variant={variantMap[type]} {...props}>
        {iconMap[type]}
      </SquareTag>
    </Tooltip>
  );
}

const SquareTag = styled(Tag)`
  width: 20px;
  padding: 0;
  justify-content: center;
`;
