import styled from '@emotion/styled';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import {UnhandledTag} from 'sentry/components/group/inboxBadges/unhandledTag';
import {t} from 'sentry/locale';
import type {EventOrGroupType, Level} from 'sentry/types/event';
import {eventTypeHasLogLevel} from 'sentry/utils/events';
import {Divider} from 'sentry/views/issueDetails/divider';

type Props = {
  message: React.ReactNode;
  type: EventOrGroupType;
  className?: string;
  level?: Level;
  showUnhandled?: boolean;
};

export function EventMessage({
  className,
  level,
  message,
  type,
  showUnhandled = false,
}: Props) {
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
      {showUnhandled ? <Divider /> : null}
      {renderedMessage}
    </LevelMessageContainer>
  );
}

const LevelMessageContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  line-height: 1.2;
  overflow: hidden;
`;

const Message = styled('div')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
  max-height: 38px;
`;

const NoMessage = styled(Message)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ErrorLevelWithMargin = styled(ErrorLevel)`
  margin-right: ${p => p.theme.space['2xs']};
`;
