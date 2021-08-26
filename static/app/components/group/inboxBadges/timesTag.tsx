import styled from '@emotion/styled';

import TimeSince from 'app/components/timeSince';
import {IconClock} from 'app/icons';
import {t} from 'app/locale';
import getDynamicText from 'app/utils/getDynamicText';

/**
 * Used in new inbox
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */

type Props = {
  lastSeen: string;
  firstSeen: string;
};

const TimesTag = ({lastSeen, firstSeen}: Props) => {
  return (
    <Wrapper>
      <StyledIconClock size="xs" color="gray300" />
      {lastSeen &&
        getDynamicText({
          value: (
            <TimeSince
              tooltipTitle={t('Last Seen')}
              date={lastSeen}
              suffix={t('ago')}
              shorten
            />
          ),
          fixed: '10s ago',
        })}
      {firstSeen && lastSeen && (
        <Separator className="hidden-xs hidden-sm">&nbsp;|&nbsp;</Separator>
      )}
      {firstSeen &&
        getDynamicText({
          value: (
            <TimeSince
              tooltipTitle={t('First Seen')}
              date={firstSeen}
              suffix={t('old')}
              className="hidden-xs hidden-sm"
              shorten
            />
          ),
          fixed: '10s old',
        })}
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Separator = styled('span')`
  color: ${p => p.theme.subText};
`;

const StyledIconClock = styled(IconClock)`
  margin-right: 2px;
`;

export default TimesTag;
