import styled from '@emotion/styled';

import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {withChonk} from 'sentry/utils/theme/withChonk';

import {Badge, type BadgeProps} from './badge';

const defaultTitles: Record<FeatureBadgeProps['type'], string> = {
  alpha: t('This feature is internal and available for QA purposes'),
  beta: t('This feature is available for early adopters and may change'),
  new: t('This feature is new! Try it out and let us know what you think'),
  experimental: t(
    'This feature is experimental! Try it out and let us know what you think. No promises!'
  ),
};

const labels: Record<FeatureBadgeProps['type'], string> = {
  alpha: t('alpha'),
  beta: t('beta'),
  new: t('new'),
  experimental: t('experimental'),
};

export interface FeatureBadgeProps extends Omit<BadgeProps, 'children'> {
  type: 'alpha' | 'beta' | 'new' | 'experimental';
  tooltipProps?: Partial<TooltipProps>;
}

function InnerFeatureBadge({type, tooltipProps, ...props}: FeatureBadgeProps) {
  const title = tooltipProps?.title ?? defaultTitles[type] ?? '';

  return (
    <Tooltip title={title} position="right" {...tooltipProps} skipWrapper>
      <StyledBadge type={type} {...props}>
        {labels[type]}
      </StyledBadge>
    </Tooltip>
  );
}

/**
 * Requires the result of styled(Badge) to be exported as it
 * is in some cases targeted with a child selector.
 */
export const FeatureBadge = styled(InnerFeatureBadge)``;

const ChonkStyledBadge = styled(Badge)`
  text-transform: capitalize;
`;

const StyledBadge = withChonk(
  styled(Badge)`
    margin: 0;
    padding: 0 ${space(0.75)};
    height: ${space(2)};
    vertical-align: middle;
  `,
  ChonkStyledBadge
);
