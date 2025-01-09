import styled from '@emotion/styled';

import ErrorLevel from 'sentry/components/events/errorLevel';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventOrGroupType, Level} from 'sentry/types/event';
import type {BaseGroup, GroupTombstoneHelper} from 'sentry/types/group';
import {eventTypeHasLogLevel, getTitle} from 'sentry/utils/events';
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
  levelIndicatorSize?: '9px' | '10px' | '11px';
  showUnhandled?: boolean;
};

function EventMessage({
  data,
  className,
  level,
  levelIndicatorSize,
  message,
  type,
  showUnhandled = false,
}: Props) {
  const organization = useOrganization({allowNull: true});
  const hasStreamlinedUI = useHasStreamlinedUI();

  // TODO(malwilley): When the new layout is GA'd, this component should be renamed
  const hasNewIssueStreamTableLayout = organization?.features.includes(
    'issue-stream-table-layout'
  );

  const showEventLevel = level && eventTypeHasLogLevel(type);
  const {subtitle} = getTitle(data);
  const renderedMessage = message ? (
    <Message>{message}</Message>
  ) : (
    <NoMessage>({t('No error message')})</NoMessage>
  );

  return (
    <LevelMessageContainer className={className}>
      {showEventLevel && <ErrorLevel level={level} size={levelIndicatorSize} />}
      {hasStreamlinedUI && showEventLevel ? <Divider /> : null}
      {showUnhandled ? <UnhandledTag /> : null}
      {hasStreamlinedUI && showUnhandled ? <Divider /> : null}
      {hasNewIssueStreamTableLayout ? subtitle : renderedMessage}
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
