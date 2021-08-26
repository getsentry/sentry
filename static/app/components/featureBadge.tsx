import * as React from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import CircleIndicator from 'app/components/circleIndicator';
import Tag from 'app/components/tagDeprecated';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type BadgeProps = {
  type: 'alpha' | 'beta' | 'new';
  theme: Theme;
  variant?: 'indicator' | 'badge';
  title?: string;
  noTooltip?: boolean;
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

const FeatureBadge = ({
  type,
  variant = 'badge',
  title,
  theme,
  noTooltip,
  ...p
}: Props) => (
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

const StyledTag = styled(Tag)`
  padding: 3px ${space(0.75)};
`;

const StyledFeatureBadge = styled(withTheme(FeatureBadge))`
  display: inline-flex;
  align-items: center;
  margin-left: ${space(0.75)};
  position: relative;
  top: -1px;
`;

export default StyledFeatureBadge;
