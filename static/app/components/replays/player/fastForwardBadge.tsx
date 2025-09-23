import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  speed: number;
  className?: string;
};

function FastForwardBadge({speed, className}: Props) {
  return (
    <Badge className={className}>
      <FastForwardTooltip title={t('Fast forwarding at %sx', speed)}>
        {t('Fast forwarding through inactivity')}
        <IconArrow size="sm" direction="right" />
      </FastForwardTooltip>
    </Badge>
  );
}

/* Position the badge in the corner */
const Badge = styled('div')`
  user-select: none;
  display: grid;
  align-items: end;
  justify-items: start;
`;

/* Badge layout and style */
const FastForwardTooltip = styled(Tooltip)`
  display: flex;
  align-items: center;
  > svg {
    margin-left: ${p => p.theme.space.sm};
  }
  background: ${p => p.theme.gray300};
  color: ${p => p.theme.white};
  padding: ${space(1.5)} ${space(2)};
  border-top-right-radius: ${p => p.theme.borderRadius};
  z-index: ${p => p.theme.zIndex.initial};
`;

export default FastForwardBadge;
