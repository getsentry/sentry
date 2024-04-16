import styled from '@emotion/styled';

import ErrorLevel from 'sentry/components/events/errorLevel';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventOrGroupType, type Level} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  type: EventOrGroupType;
  annotations?: React.ReactNode;
  className?: string;
  hasGuideAnchor?: boolean;
  level?: Level;
  levelIndicatorSize?: string;
  message?: React.ReactNode;
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

function EventOrGroupLevel({
  level,
  levelIndicatorSize,
  type,
}: Pick<Props, 'level' | 'levelIndicatorSize' | 'type'>) {
  if (level && EVENT_TYPES_WITH_LOG_LEVEL.has(type)) {
    return <ErrorLevel level={level} size={levelIndicatorSize} />;
  }

  return null;
}

function EventMessage({
  className,
  annotations,
  level,
  levelIndicatorSize,
  message,
  type,
  showUnhandled = false,
}: Props) {
  const organization = useOrganization({allowNull: true});
  const hasIssuePriority = organization?.features.includes('issue-priority-ui');

  if (!hasIssuePriority) {
    return (
      <LevelMessageContainer className={className}>
        {level ? (
          <EventOrGroupLevel
            level={level}
            levelIndicatorSize={levelIndicatorSize}
            type={type}
          />
        ) : null}
        {showUnhandled ? <UnhandledTag /> : null}
        {message ? <Message>{message}</Message> : null}
      </LevelMessageContainer>
    );
  }

  return (
    <LevelMessageContainer className={className}>
      <EventOrGroupLevel
        level={level}
        levelIndicatorSize={levelIndicatorSize}
        type={type}
      />
      {showUnhandled ? <UnhandledTag /> : null}
      {message ? (
        <Message>{message}</Message>
      ) : (
        <NoMessage>({t('No error message')})</NoMessage>
      )}
      {annotations}
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
