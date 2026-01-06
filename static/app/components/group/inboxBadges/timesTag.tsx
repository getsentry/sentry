import styled from '@emotion/styled';

import TimeSince from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

/**
 * Used in new inbox
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */

type Props = {
  firstSeen: string;
  lastSeen: string;
};

function TimesTag({lastSeen, firstSeen}: Props) {
  return (
    <Wrapper>
      <StyledIconClock size="xs" variant="muted" />
      {lastSeen && (
        <TimeSince
          tooltipPrefix={t('Last Seen')}
          date={lastSeen}
          suffix={t('ago')}
          unitStyle="short"
        />
      )}
      {firstSeen && lastSeen && (
        <Separator className="hidden-xs hidden-sm">&nbsp;|&nbsp;</Separator>
      )}
      {firstSeen && (
        <TimeSince
          tooltipPrefix={t('First Seen')}
          date={firstSeen}
          suffix={t('old')}
          className="hidden-xs hidden-sm"
          unitStyle="short"
        />
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
`;

const Separator = styled('span')`
  color: ${p => p.theme.subText};
`;

const StyledIconClock = styled(IconClock)`
  margin-right: ${space(0.5)};
`;

export default TimesTag;
