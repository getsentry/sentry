import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
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
    <Tag icon={lastSeen ? <IconClock /> : undefined}>
      {lastSeen && <TimeSince date={lastSeen} suffix={t('ago')} shorten />}
      {firstSeen && lastSeen && (
        <Seperator className="hidden-xs hidden-sm">&nbsp;|&nbsp;</Seperator>
      )}
      {firstSeen && (
        <TimeSince
          date={firstSeen}
          suffix={t('old')}
          className="hidden-xs hidden-sm"
          shorten
        />
      )}
    </Tag>
  );
};

const Seperator = styled('span')`
  color: ${p => p.theme.subText};
`;

export default TimesTag;
