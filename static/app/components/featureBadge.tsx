import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {captureException, withScope} from '@sentry/react';
import type {SeverityLevel} from '@sentry/types';

import Badge from 'sentry/components/badge';
import CircleIndicator from 'sentry/components/circleIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space, {ValidSize} from 'sentry/styles/space';

type BadgeProps = {
  type: 'alpha' | 'beta' | 'new';
  expiresAt?: Date;
  noTooltip?: boolean;
  title?: string;
  variant?: 'indicator' | 'badge';
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof BadgeProps> & BadgeProps;

const defaultTitles = {
  alpha: t('This feature is internal and available for QA purposes'),
  beta: t('This feature is available for early adopters and may change'),
  new: t('This feature is new! Try it out and let us know what you think'),
};

const labels = {
  alpha: t('alpha'),
  beta: t('beta'),
  new: t('new'),
};

function BaseFeatureBadge({
  type,
  variant = 'badge',
  title,
  noTooltip,
  expiresAt,
  ...props
}: Props) {
  const theme = useTheme();
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
    return null;
  }

  return (
    <div {...props}>
      <Tooltip title={title ?? defaultTitles[type]} disabled={noTooltip} position="right">
        <Fragment>
          {variant === 'badge' && <StyledBadge type={type} text={labels[type]} />}
          {variant === 'indicator' && (
            <CircleIndicator color={theme.badge[type].indicatorColor} size={8} />
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
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  vertical-align: middle;
`;

const FeatureBadge = styled(BaseFeatureBadge)<{space?: ValidSize}>`
  display: inline-flex;
  align-items: center;
  margin-left: ${p => space(p.space ?? 0.75)};
`;

export default FeatureBadge;
