import styled from '@emotion/styled';
import {IconClock} from '@sentry/icons/clock';

import {Flex} from '@sentry/scraps/layout';

import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';

/**
 * Used in new inbox
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */

type Props = {
  firstSeen: string;
  lastSeen: string;
};

export function TimesTag({lastSeen, firstSeen}: Props) {
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
      {firstSeen && (
        <Flex
          as="span"
          align="center"
          // Hide by viewport width; a container query would change where first seen appears.
          // oxlint-disable-next-line @sentry/scraps/prefer-container-responsive-props
          display={{zero: 'none', 'screen:md': 'flex'}}
        >
          {lastSeen && <Separator>&nbsp;|&nbsp;</Separator>}
          <TimeSince
            tooltipPrefix={t('First Seen')}
            date={firstSeen}
            suffix={t('old')}
            unitStyle="short"
          />
        </Flex>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
`;

const Separator = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledIconClock = styled(IconClock)`
  margin-right: ${p => p.theme.space.xs};
`;
