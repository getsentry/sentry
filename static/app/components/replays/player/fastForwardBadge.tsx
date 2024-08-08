import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

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
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${p => p.theme.space(0.5)};
  align-items: center;

  background: ${p => p.theme.gray300};
  color: ${p => p.theme.white};
  padding: ${p => p.theme.space(1.5)} ${p => p.theme.space(2)};
  border-top-right-radius: ${p => p.theme.borderRadius};
  z-index: ${p => p.theme.zIndex.initial};
`;

export default FastForwardBadge;
