import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import EventMessage from 'sentry/components/events/eventMessage';
import EventTitleError from 'sentry/components/eventTitleError';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconStar} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Level, Organization} from 'sentry/types';
import {getLocation, getMessage, isTombstone} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

interface EventOrGroupHeaderProps {
  data: Group;
  event_id: string;
  organization: Organization;
}

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
interface IssueTitleChildrenProps {
  data: Group;
  organization: Organization;
}
function IssueTitleChildren(props: IssueTitleChildrenProps) {
  const hasIssuePriority = props.organization.features.includes('issue-priority-ui');
  const {level, isBookmarked, hasSeen} = props.data;

  return (
    <Fragment>
      {level && !hasIssuePriority && <GroupLevel level={level} />}
      {isBookmarked && (
        <IconWrapper>
          <IconStar isSolid color="yellow400" />
        </IconWrapper>
      )}
      <ErrorBoundary customComponent={<EventTitleError />} mini>
        <StyledEventOrGroupTitle
          data={props.data}
          organization={props.organization}
          // hasSeen is undefined for GroupTombstone
          hasSeen={hasSeen === undefined ? true : hasSeen}
          withStackTracePreview
        />
      </ErrorBoundary>
    </Fragment>
  );
}

interface IssueTitleProps {
  data: Group;
  event_id: string;
}
function IssueTitle(props: IssueTitleProps) {
  const organization = useOrganization();
  const commonEleProps = {
    'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
  };

  if (isTombstone(props.data)) {
    return (
      <TitleWithoutLink {...commonEleProps}>
        <IssueTitleChildren data={props.data} organization={organization} />
      </TitleWithoutLink>
    );
  }

  return (
    <TitleWithLink
      {...commonEleProps}
      to={{
        pathname: `/organizations/${organization.slug}/issues/${props.data.id}/events/${props.event_id}/`,
      }}
    >
      <IssueTitleChildren data={props.data} organization={organization} />
    </TitleWithLink>
  );
}

export function IssueSummary({data, event_id}: EventOrGroupHeaderProps) {
  const organization = useOrganization();
  const hasIssuePriority = organization.features.includes('issue-priority-ui');

  const eventLocation = getLocation(data);

  return (
    <div data-test-id="event-issue-header">
      <Title>
        <IssueTitle data={data} event_id={event_id} />
      </Title>
      {eventLocation ? <Location>{eventLocation}</Location> : null}
      <StyledEventMessage
        level={hasIssuePriority && 'level' in data ? data.level : undefined}
        message={getMessage(data)}
        type={data.type}
        levelIndicatorSize="9px"
      />
    </div>
  );
}

const Title = styled('div')`
  margin-bottom: ${space(0.25)};
  & em {
    font-size: ${p => p.theme.fontSizeMedium};
    font-style: normal;
    font-weight: 300;
    color: ${p => p.theme.subText};
  }
`;

const LocationWrapper = styled('div')`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0 5px;
  direction: rtl;
  text-align: left;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  span {
    direction: ltr;
  }
`;

function Location(props) {
  const {children, ...rest} = props;
  return (
    <LocationWrapper {...rest}>
      {tct('in [location]', {
        location: <span>{children}</span>,
      })}
    </LocationWrapper>
  );
}

const StyledEventMessage = styled(EventMessage)`
  margin: 0 0 5px;
  gap: ${space(0.5)};
`;

const IconWrapper = styled('span')`
  position: relative;
  margin-right: 5px;
`;

const GroupLevel = styled(ErrorLevel)<{level: Level}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;
`;

const TitleWithLink = styled(GlobalSelectionLink)`
  display: inline-flex;
  align-items: center;
`;
const TitleWithoutLink = styled('span')`
  display: inline-flex;
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)<{
  hasSeen: boolean;
}>`
  font-weight: ${p => (p.hasSeen ? 400 : 600)};
`;
