import styled from '@emotion/styled';

import ErrorLevel from 'sentry/components/events/errorLevel';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventOrGroupType, Level} from 'sentry/types/event';
import type {BaseGroup, GroupTombstoneHelper} from 'sentry/types/group';
import {eventTypeHasLogLevel} from 'sentry/utils/events';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  data: Event | BaseGroup | GroupTombstoneHelper;
  message: React.ReactNode;
  type: EventOrGroupType;
  className?: string;
  level?: Level;
  showUnhandled?: boolean;
};

function EventMessage({className, level, message, type, showUnhandled = false}: Props) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const showEventLevel = level && eventTypeHasLogLevel(type);
  const renderedMessage = message ? (
    <Message>{message}</Message>
  ) : (
    <NoMessage>({t('No error message')})</NoMessage>
  );

  return (
    <LevelMessageContainer className={className}>
      {showEventLevel && <ErrorLevelWithMargin level={level} />}
      {showUnhandled ? <UnhandledTag /> : null}
      {hasStreamlinedUI && showUnhandled ? <Divider /> : null}
      {renderedMessage}
    </LevelMessageContainer>
  );
}

const LevelMessageContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  line-height: 1.2;
  overflow: hidden;
`;

const Message = styled('div')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
  max-height: 38px;
`;

const NoMessage = styled(Message)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ErrorLevelWithMargin = styled(ErrorLevel)`
  margin-right: ${space(0.25)};
`;

export default EventMessage;
