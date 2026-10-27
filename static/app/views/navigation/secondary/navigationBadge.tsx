import styled from '@emotion/styled';

import {Badge, FeatureBadge} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

export function NavigationBadge({badge}: {badge: string | number | null}) {
  if (badge === 'new' || badge === 'beta' || badge === 'alpha') {
    return <FeatureBadge type={badge} />;
  }
  if (badge === 'warning') {
    return (
      <Tooltip title={t('This setting needs review')} position="right">
        <StyledBadge variant="warning">{badge}</StyledBadge>
      </Tooltip>
    );
  }
  if (typeof badge === 'string' || typeof badge === 'number') {
    return <StyledBadge variant="muted">{badge}</StyledBadge>;
  }

  return null;
}

const StyledBadge = styled(Badge)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  height: auto;
  line-height: 1;
  font-size: ${p => p.theme.font.size.xs};
  padding: 3px ${p => p.theme.space.sm};
  vertical-align: middle;
`;
