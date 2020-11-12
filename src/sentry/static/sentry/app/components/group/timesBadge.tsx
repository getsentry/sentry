import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconClock} from 'app/icons';
import TimeSince from 'app/components/timeSince';
import Tag from 'app/components/tag';

/**
 * Used in new inbox
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */

type Props = {
  lastSeen: string;
  firstSeen: string;
};

const TimesBadge = ({lastSeen, firstSeen}: Props) => {
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
  color: ${p => p.theme.gray400};
`;

export default TimesBadge;
