import styled from '@emotion/styled';

import ErrorLevel from 'sentry/components/events/errorLevel';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventOrGroupType, Level} from 'sentry/types/event';
import type {BaseGroup, GroupTombstoneHelper} from 'sentry/types/group';
import {eventTypeHasLogLevel} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  data: Event | BaseGroup | GroupTombstoneHelper;
  message: React.ReactNode;
  type: EventOrGroupType;
  className?: string;
  level?: Level;
  /**
   * Size of the level indicator.
   */
  levelIndicatorSize?: 9 | 10 | 11;
  showUnhandled?: boolean;
};

function EventMessage({
  className,
  level,
  levelIndicatorSize,
  message,
  type,
  showUnhandled = false,
}: Props) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const organization = useOrganization({allowNull: true});
  const showEventLevel = level && eventTypeHasLogLevel(type);
  const hasNewIssueStreamTableLayout = organization?.features.includes(
    'issue-stream-table-layout'
  );
  const renderedMessage = message ? (
    <Message>{message}</Message>
  ) : (
    <NoMessage>({t('No error message')})</NoMessage>
  );

  const showErrorLevelDivider = Boolean(
    hasStreamlinedUI && showEventLevel && !hasNewIssueStreamTableLayout
  );

  return (
    <LevelMessageContainer className={className}>
      {showEventLevel && (
        <ErrorLevelWithMargin
          level={level}
          size={levelIndicatorSize}
          hasDivider={showErrorLevelDivider}
        />
      )}
      {showErrorLevelDivider ? <Divider /> : null}
      {showUnhandled ? <UnhandledTag /> : null}
      {hasStreamlinedUI && showUnhandled ? <Divider /> : null}
      {renderedMessage}
    </LevelMessageContainer>
  );
}

const LevelMessageContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
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
  color: ${p => p.theme.subText};
`;

const ErrorLevelWithMargin = styled(ErrorLevel)<{hasDivider: boolean}>`
  margin-right: ${p => (p.hasDivider ? 0 : space(0.5))};
`;

export default EventMessage;
