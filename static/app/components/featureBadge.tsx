import * as React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import Tag from 'sentry/components/tagDeprecated';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type BadgeProps = {
  type: 'alpha' | 'beta' | 'new';
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

function BaseFeatureBadge({type, variant = 'badge', title, noTooltip, ...p}: Props) {
  const theme = useTheme();

  return (
    <div {...p}>
      <Tooltip title={title ?? defaultTitles[type]} disabled={noTooltip} position="right">
        <React.Fragment>
          {variant === 'badge' && <StyledTag priority={type}>{labels[type]}</StyledTag>}
          {variant === 'indicator' && (
            <CircleIndicator color={theme.badge[type].indicatorColor} size={8} />
          )}
        </React.Fragment>
      </Tooltip>
    </div>
  );
}

const StyledTag = styled(Tag)`
  padding: 3px ${space(0.75)};
`;

const FeatureBadge = styled(BaseFeatureBadge)`
  display: inline-flex;
  align-items: center;
  margin-left: ${space(0.75)};
  position: relative;
  top: -1px;
`;

export default FeatureBadge;
