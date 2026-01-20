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
        <StyledIconArrow size="sm" direction="right" />
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
  background: ${p => p.theme.colors.gray400};
  color: ${p => p.theme.colors.white};
  padding: ${space(1.5)} ${space(2)};
  border-top-right-radius: ${p => p.theme.radius.md};
  z-index: ${p => p.theme.zIndex.initial};
`;

const StyledIconArrow = styled(IconArrow)`
  margin-left: ${p => p.theme.space.sm};
  vertical-align: text-top;
`;

export default FastForwardBadge;
