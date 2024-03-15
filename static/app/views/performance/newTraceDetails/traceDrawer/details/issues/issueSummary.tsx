import {Fragment} from 'react';
import {css} from '@emotion/react';
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
import withOrganization from 'sentry/utils/withOrganization';

interface EventOrGroupHeaderProps {
  data: Group;
  event_id: string;
  organization: Organization;
}

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
function IssueSummary({data, organization, event_id}: EventOrGroupHeaderProps) {
  const hasIssuePriority = organization.features.includes('issue-priority-ui');

  function getTitleChildren() {
    const {level, isBookmarked, hasSeen} = data as Group;
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
            data={data}
            organization={organization}
            // hasSeen is undefined for GroupTombstone
            hasSeen={hasSeen === undefined ? true : hasSeen}
            withStackTracePreview
          />
        </ErrorBoundary>
      </Fragment>
    );
  }

  function getTitle() {
    const {id, status} = data as Group;

    const commonEleProps = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
    };

    if (isTombstone(data)) {
      return (
        <TitleWithoutLink {...commonEleProps}>{getTitleChildren()}</TitleWithoutLink>
      );
    }

    return (
      <TitleWithLink
        {...commonEleProps}
        to={{
          pathname: `/organizations/${organization.slug}/issues/${id}/events/${event_id}/`,
        }}
      >
        {getTitleChildren()}
      </TitleWithLink>
    );
  }

  const eventLocation = getLocation(data);

  return (
    <div data-test-id="event-issue-header">
      <Title>{getTitle()}</Title>
      {eventLocation && <Location>{eventLocation}</Location>}
      <StyledEventMessage
        level={hasIssuePriority && 'level' in data ? data.level : undefined}
        message={getMessage(data)}
        type={data.type}
        levelIndicatorSize="9px"
      />
    </div>
  );
}

const truncateStyles = css`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

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
  ${truncateStyles};
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

export default withOrganization(IssueSummary);

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)<{
  hasSeen: boolean;
}>`
  font-weight: ${p => (p.hasSeen ? 400 : 600)};
`;
