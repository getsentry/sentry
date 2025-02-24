import {Fragment, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {SeverityLevel} from '@sentry/core';
import {captureException, withScope} from '@sentry/react';

import Badge, {type BadgeType} from 'sentry/components/badge/badge';
import CircleIndicator from 'sentry/components/circleIndicator';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {ValidSize} from 'sentry/styles/space';
import {space} from 'sentry/styles/space';

export type FeatureBadgeType = Extract<
  BadgeType,
  'alpha' | 'beta' | 'new' | 'experimental' | 'internal'
>;

type BadgeProps = {
  type: FeatureBadgeType;
  condensed?: boolean;
  expiresAt?: Date;
  title?: ReactNode;
  tooltipProps?: Partial<TooltipProps>;
  variant?: 'badge' | 'indicator' | 'short';
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof BadgeProps> & BadgeProps;

const defaultTitles: Record<FeatureBadgeType, string> = {
  alpha: t('This feature is internal and available for QA purposes'),
  beta: t('This feature is available for early adopters and may change'),
  new: t('This feature is new! Try it out and let us know what you think'),
  experimental: t(
    'This feature is experimental! Try it out and let us know what you think. No promises!'
  ),
  internal: t('This feature is for internal use only'),
};

const labels: Record<FeatureBadgeType, string> = {
  alpha: t('alpha'),
  beta: t('beta'),
  new: t('new'),
  experimental: t('experimental'),
  internal: t('internal'),
};

const shortLabels: Record<FeatureBadgeType, string> = {
  alpha: 'A',
  beta: 'B',
  new: 'N',
  experimental: 'E',
  internal: 'I',
};

const useIndicatorColor = () => {
  const theme = useTheme();

  return {
    alpha: theme.pink300,
    beta: theme.purple300,
    new: theme.green300,
    experimental: theme.gray100,
    internal: theme.gray100,
  } satisfies Record<FeatureBadgeType, string>;
};

function BaseFeatureBadge({
  type,
  variant = 'badge',
  title,
  tooltipProps,
  expiresAt,
  ...props
}: Props) {
  const indicatorColors = useIndicatorColor();
  if (expiresAt && expiresAt.valueOf() < Date.now()) {
    // Only get 1% of events as we don't need many to know that a badge needs to be cleaned up.
    if (Math.random() < 0.01) {
      withScope(scope => {
        scope.setTag('title', title?.toString());
        scope.setTag('type', type);
        scope.setLevel('warning' as SeverityLevel);
        captureException(new Error('Expired Feature Badge'));
      });
    }
    return null;
  }

  return (
    <div {...props}>
      <Tooltip title={title ?? defaultTitles[type]} position="right" {...tooltipProps}>
        <Fragment>
          {variant === 'badge' && <StyledBadge type={type} text={labels[type]} />}
          {variant === 'short' && <StyledBadge type={type} text={shortLabels[type]} />}
          {variant === 'indicator' && (
            <CircleIndicator color={indicatorColors[type]} size={8} />
          )}
        </Fragment>
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

const FeatureBadge = styled(BaseFeatureBadge)<{space?: ValidSize}>`
  display: inline-flex;
  align-items: center;
  margin-left: ${p => space(p.space ?? 0.75)};
`;

export default FeatureBadge;
