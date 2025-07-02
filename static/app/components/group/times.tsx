import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

/**
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */

type Props = {
  firstSeen: string;
  lastSeen: string;
};

function Times({lastSeen, firstSeen}: Props) {
  return (
    <Container>
      <Flex align="center">
        {lastSeen && (
          <Fragment>
            <StyledIconClock size="xs" />
            <TextOverflow>
              <TimeSince date={lastSeen} suffix={t('ago')} />
            </TextOverflow>
          </Fragment>
        )}
        {firstSeen && lastSeen && (
          <span className="hidden-xs hidden-sm">&nbsp;—&nbsp;</span>
        )}
        {firstSeen && (
          <TextOverflow>
            <TimeSince
              date={firstSeen}
              suffix={t('old')}
              className="hidden-xs hidden-sm"
            />
          </TextOverflow>
        )}
      </Flex>
    </Container>
  );
}

const Container = styled('div')`
  flex-shrink: 1;
  min-width: 0; /* flex-hack for overflow-ellipsised children */
`;

const StyledIconClock = styled(IconClock)`
  /* this is solely for optics, since TimeSince always begins
  with a number, and numbers do not have descenders */
  margin-right: ${space(0.5)};
  min-width: 12px;
`;

export default Times;
