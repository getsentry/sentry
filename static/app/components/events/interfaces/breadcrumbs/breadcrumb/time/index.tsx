import {memo} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Highlight from 'sentry/components/highlight';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getFormattedTimestamp} from 'sentry/utils/date/getFormattedTimestamp';

type Props = {
  searchTerm: string;
  displayRelativeTime?: boolean;
  relativeTime?: string;
  timestamp?: string;
};

const Time = memo(function Time({
  timestamp,
  relativeTime,
  displayRelativeTime,
  searchTerm,
}: Props) {
  if (!(defined(timestamp) && defined(relativeTime))) {
    return <div />;
  }

  const {date, timeWithMilliseconds, time, displayTime} = getFormattedTimestamp(
    timestamp,
    relativeTime,
    displayRelativeTime
  );

  return (
    <Wrapper>
      <Tooltip
        title={
          <Title>
            <div>{date}</div>
            <div>{timeWithMilliseconds}</div>
            {time !== '\u2014' && !!time && <div>{time}</div>}
          </Title>
        }
        containerDisplayMode="inline-flex"
      >
        <Highlight text={searchTerm}>{displayTime}</Highlight>
      </Tooltip>
    </Wrapper>
  );
});

export default Time;

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.primary};
`;

const Title = styled('div')`
  display: grid;
  gap: ${space(0.75)};
`;
