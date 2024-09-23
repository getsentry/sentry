import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorLevel from 'sentry/components/events/errorLevel';
import {ErrorLevelText} from 'sentry/components/events/errorLevelText';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventOrGroupType, type Level} from 'sentry/types/event';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  message: React.ReactNode;
  type: EventOrGroupType;
  className?: string;
  level?: Level;
  /**
   * Size of the level indicator.
   */
  levelIndicatorSize?: '9px' | '11px';
  showUnhandled?: boolean;
};

const EVENT_TYPES_WITH_LOG_LEVEL = new Set([
  EventOrGroupType.ERROR,
  EventOrGroupType.CSP,
  EventOrGroupType.EXPECTCT,
  EventOrGroupType.DEFAULT,
  EventOrGroupType.EXPECTSTAPLE,
  EventOrGroupType.HPKP,
  EventOrGroupType.NEL,
]);

function EventMessage({
  className,
  level,
  levelIndicatorSize,
  message,
  type,
  showUnhandled = false,
}: Props) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const showEventLevel = level && EVENT_TYPES_WITH_LOG_LEVEL.has(type);
  return (
    <LevelMessageContainer className={className}>
      {!hasStreamlinedUI ? <ErrorLevel level={level} size={levelIndicatorSize} /> : null}
      {showUnhandled ? <UnhandledTag /> : null}
      {hasStreamlinedUI && showEventLevel ? (
        <Fragment>
          {showUnhandled ? <Divider /> : null}
          <ErrorLevelText level={level} />
          <Divider />
        </Fragment>
      ) : null}
      {message ? (
        <Message>{message}</Message>
      ) : (
        <NoMessage>({t('No error message')})</NoMessage>
      )}
    </LevelMessageContainer>
  );
}

const LevelMessageContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  position: relative;
  line-height: 1.2;
  overflow: hidden;
`;

const Message = styled('div')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
  max-height: 38px;
`;

const NoMessage = styled(Message)`
  color: ${p => p.theme.subText};
`;

export default EventMessage;
