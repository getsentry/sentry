import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import {Badge} from 'sentry/components/core/badge';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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

const shortLabels: Record<FeatureBadgeProps['type'], string> = {
  alpha: 'A',
  beta: 'B',
  new: 'N',
  experimental: 'E',
};

const useFeatureBadgeIndicatorColor = () => {
  const theme = useTheme();

  return {
    alpha: theme.pink300,
    beta: theme.purple300,
    new: theme.green300,
    experimental: theme.gray100,
  } satisfies Record<FeatureBadgeProps['type'], string>;
};

export interface FeatureBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  type: 'alpha' | 'beta' | 'new' | 'experimental';
  tooltipProps?: Partial<TooltipProps>;
  variant?: 'badge' | 'indicator' | 'short';
}

function InnerFeatureBadge({
  type,
  variant = 'badge',
  tooltipProps,
  ...props
}: FeatureBadgeProps) {
  const indicatorColors = useFeatureBadgeIndicatorColor();
  const title = tooltipProps?.title?.toString() ?? defaultTitles[type] ?? '';

  return (
    <div {...props}>
      <Tooltip title={title ?? defaultTitles[type]} position="right" {...tooltipProps}>
        {variant === 'badge' || variant === 'short' ? (
          <StyledBadge type={type}>
            {variant === 'short' ? shortLabels[type] : labels[type]}
          </StyledBadge>
        ) : (
          <CircleIndicator color={indicatorColors[type]} size={8} />
        )}
      </Tooltip>
    </div>
  );
}

const StyledBadge = styled(Badge)`
  margin: 0;
  padding: 0 ${space(0.75)};
  line-height: ${space(2)};
  height: ${space(2)};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  vertical-align: middle;
`;

export const FeatureBadge = styled(InnerFeatureBadge)`
  display: inline-flex;
  align-items: center;
  margin-left: ${space(0.75)};
`;

/**
 * Requires the result of styled(Badge) to be exported as it
 * is in some cases targeted with a child selector.
 */
export default FeatureBadge;
