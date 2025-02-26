import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {SeverityLevel} from '@sentry/core';
import {captureException, withScope} from '@sentry/react';

import CircleIndicator from 'sentry/components/circleIndicator';
import Badge from 'sentry/components/core/badge';
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
  internal: t('This feature is for internal use only'),
};

const labels: Record<FeatureBadgeProps['type'], string> = {
  alpha: t('alpha'),
  beta: t('beta'),
  new: t('new'),
  experimental: t('experimental'),
  internal: t('internal'),
};

const shortLabels: Record<FeatureBadgeProps['type'], string> = {
  alpha: 'A',
  beta: 'B',
  new: 'N',
  experimental: 'E',
  internal: 'I',
};

const useFeatureBadgeIndicatorColor = () => {
  const theme = useTheme();

  return {
    alpha: theme.pink300,
    beta: theme.purple300,
    new: theme.green300,
    experimental: theme.gray100,
    internal: theme.gray100,
  } satisfies Record<FeatureBadgeProps['type'], string>;
};

export interface FeatureBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  type: 'alpha' | 'beta' | 'new' | 'experimental' | 'internal';
  expiresAt?: Date;
  tooltipProps?: Partial<TooltipProps>;
  variant?: 'badge' | 'indicator' | 'short';
}

function InnerFeatureBadge({
  type,
  variant = 'badge',
  tooltipProps,
  expiresAt,
  ...props
}: FeatureBadgeProps) {
  const indicatorColors = useFeatureBadgeIndicatorColor();

  if (
    hasFeatureBadgeExpired(
      expiresAt,
      tooltipProps?.title?.toString() ?? '<unknown title>',
      type
    )
  ) {
    return null;
  }

  const {title, ...restTooltipProps} = tooltipProps ?? {};

  return (
    <div {...props}>
      <Tooltip
        title={title ?? defaultTitles[type]}
        position="right"
        {...restTooltipProps}
      >
        {variant === 'badge' || variant === 'short' ? (
          <StyledBadge
            type={type}
            text={variant === 'short' ? shortLabels[type] : labels[type]}
          />
        ) : (
          <CircleIndicator color={indicatorColors[type]} size={8} />
        )}
      </Tooltip>
    </div>
  );
}

/**
 * Checks if a feature badge has expired - if it has, reports the result to Sentry
 * @param expiresAt The date the feature badge expires.
 * @returns True if the feature badge has expired, false otherwise.
 */
function hasFeatureBadgeExpired(
  expiresAt: Date | undefined,
  title: string,
  type: FeatureBadgeProps['type']
) {
  if (expiresAt && expiresAt.valueOf() < Date.now()) {
    // Only get 1% of events as we don't need many to know that a badge needs to be cleaned up.
    if (Math.random() < 0.01) {
      withScope(scope => {
        scope.setTag('title', title);
        scope.setTag('type', type);
        scope.setLevel('warning' as SeverityLevel);
        captureException(new Error('Expired Feature Badge'));
      });
    }
    return true;
  }
  return false;
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
