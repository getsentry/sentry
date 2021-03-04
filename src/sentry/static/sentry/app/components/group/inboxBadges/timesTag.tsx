import React from 'react';
import styled from '@emotion/styled';

import TimeSince from 'app/components/timeSince';
import {IconClock} from 'app/icons';
import {t} from 'app/locale';

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
      {lastSeen && (
        <TimeSince
          tooltipTitle={t('Last Seen')}
          date={lastSeen}
          suffix={t('ago')}
          shorten
        />
      )}
      {firstSeen && lastSeen && (
        <Seperator className="hidden-xs hidden-sm">&nbsp;|&nbsp;</Seperator>
      )}
      {firstSeen && (
        <TimeSince
          tooltipTitle={t('First Seen')}
          date={firstSeen}
          suffix={t('old')}
          className="hidden-xs hidden-sm"
          shorten
        />
      )}
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Seperator = styled('span')`
  color: ${p => p.theme.subText};
`;

const StyledIconClock = styled(IconClock)`
  margin-right: 2px;
`;

export default TimesTag;
