import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconMute, IconStar} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, GroupTombstoneHelper, Level, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getLocation, getMessage, isTombstone} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import withOrganization from 'sentry/utils/withOrganization';
import {TagAndMessageWrapper} from 'sentry/views/issueDetails/unhandledTag';

import EventTitleError from './eventTitleError';

type Size = 'small' | 'normal';

interface EventOrGroupHeaderProps {
  data: Event | Group | GroupTombstoneHelper;
  organization: Organization;
  eventId?: string;
  /* is issue breakdown? */
  grouping?: boolean;
  hideIcons?: boolean;
  hideLevel?: boolean;
  index?: number;
  /** Group link clicked */
  onClick?: () => void;
  query?: string;
  size?: Size;
  source?: string;
}

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
function EventOrGroupHeader({
  data,
  index,
  organization,
  query,
  onClick,
  hideIcons,
  hideLevel,
  eventId,
  size = 'normal',
  grouping = false,
  source,
}: EventOrGroupHeaderProps) {
  const location = useLocation();

  function getTitleChildren() {
    const {level, status, isBookmarked, hasSeen} = data as Group;
    return (
      <Fragment>
        {!hideLevel && level && <GroupLevel level={level} />}
        {!hideIcons &&
          status === 'ignored' &&
          !organization.features.includes('escalating-issues') && (
            <IconWrapper>
              <IconMute color="red400" />
            </IconWrapper>
          )}
        {!hideIcons && isBookmarked && (
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
            grouping={grouping}
            query={query}
          />
        </ErrorBoundary>
      </Fragment>
    );
  }

  function getTitle() {
    const {id, status} = data as Group;
    const {eventID: latestEventId, groupID} = data as Event;
    const hasEscalatingIssues = organization.features.includes('escalating-issues');

    const commonEleProps = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
      style:
        status === 'resolved' && !hasEscalatingIssues
          ? {textDecoration: 'line-through'}
          : undefined,
    };

    if (isTombstone(data)) {
      return (
        <TitleWithoutLink {...commonEleProps}>{getTitleChildren()}</TitleWithoutLink>
      );
    }

    // If we have passed in a custom event ID, use it; otherwise use default
    const finalEventId = eventId ?? latestEventId;

    return (
      <TitleWithLink
        {...commonEleProps}
        to={{
          pathname: `/organizations/${organization.slug}/issues/${
            latestEventId ? groupID : id
          }/${finalEventId ? `events/${finalEventId}/` : ''}`,
          query: {
            referrer: source || 'event-or-group-header',
            stream_index: index,
            query,
            // This adds sort to the query if one was selected from the
            // issues list page
            ...(location.query.sort !== undefined ? {sort: location.query.sort} : {}),
            // This appends _allp to the URL parameters if they have no
            // project selected ("all" projects included in results). This is
            // so that when we enter the issue details page and lock them to
            // a project, we can properly take them back to the issue list
            // page with no project selected (and not the locked project
            // selected)
            ...(location.query.project !== undefined ? {} : {_allp: 1}),
          },
        }}
        onClick={onClick}
      >
        {getTitleChildren()}
      </TitleWithLink>
    );
  }

  const eventLocation = getLocation(data);
  const message = getMessage(data);

  return (
    <div data-test-id="event-issue-header">
      <Title>{getTitle()}</Title>
      {eventLocation && <Location size={size}>{eventLocation}</Location>}
      {message && (
        <StyledTagAndMessageWrapper size={size}>
          {message && <Message>{message}</Message>}
        </StyledTagAndMessageWrapper>
      )}
    </div>
  );
}

const truncateStyles = css`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const getMargin = ({size}: {size: Size}) => {
  if (size === 'small') {
    return 'margin: 0;';
  }

  return 'margin: 0 0 5px';
};

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
  ${getMargin};
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

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  ${getMargin};
  line-height: 1.2;
`;

const Message = styled('div')`
  ${truncateStyles};
  font-size: ${p => p.theme.fontSizeMedium};
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

export default withOrganization(EventOrGroupHeader);

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)<{
  hasSeen: boolean;
}>`
  font-weight: ${p => (p.hasSeen ? 400 : 600)};
`;
