import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
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
      <FlexWrapper align="center">
        {lastSeen && (
          <Fragment>
            <StyledIconClock legacySize="11px" />
            <TimeSince date={lastSeen} suffix={t('ago')} />
          </Fragment>
        )}
        {firstSeen && lastSeen && (
          <span className="hidden-xs hidden-sm">&nbsp;—&nbsp;</span>
        )}
        {firstSeen && (
          <TimeSince date={firstSeen} suffix={t('old')} className="hidden-xs hidden-sm" />
        )}
      </FlexWrapper>
    </Container>
  );
}

const Container = styled('div')`
  flex-shrink: 1;
  min-width: 0; /* flex-hack for overflow-ellipsised children */
`;

const FlexWrapper = styled(Flex)`
  ${p => p.theme.overflowEllipsis}
`;

const StyledIconClock = styled(IconClock)`
  /* this is solely for optics, since TimeSince always begins
  with a number, and numbers do not have descenders */
  margin-right: ${space(0.5)};
`;

export default Times;
