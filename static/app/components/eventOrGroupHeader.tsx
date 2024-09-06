import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconStar} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, GroupTombstoneHelper} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getLocation, getMessage, isTombstone} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import withOrganization from 'sentry/utils/withOrganization';

import EventTitleError from './eventTitleError';

interface EventOrGroupHeaderProps {
  data: Event | Group | GroupTombstoneHelper;
  organization: Organization;
  eventId?: string;
  hideIcons?: boolean;
  hideLevel?: boolean;
  index?: number;
  /** Group link clicked */
  onClick?: () => void;
  query?: string;
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
  eventId,
  source,
}: EventOrGroupHeaderProps) {
  const location = useLocation();

  function getTitleChildren() {
    const {isBookmarked, hasSeen} = data as Group;
    return (
      <Fragment>
        {!hideIcons && isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="yellow300" />
          </IconWrapper>
        )}
        <ErrorBoundary customComponent={<EventTitleError />} mini>
          <StyledEventOrGroupTitle
            data={data}
            // hasSeen is undefined for GroupTombstone
            hasSeen={hasSeen === undefined ? true : hasSeen}
            withStackTracePreview
            query={query}
          />
        </ErrorBoundary>
      </Fragment>
    );
  }

  function getTitle() {
    const {id, status} = data as Group;
    const {eventID: latestEventId, groupID} = data as Event;

    const commonEleProps = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
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

  return (
    <div data-test-id="event-issue-header">
      <Title>{getTitle()}</Title>
      {eventLocation && <Location>{eventLocation}</Location>}
      <StyledEventMessage
        level={'level' in data ? data.level : undefined}
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
    font-weight: ${p => p.theme.fontWeightNormal};
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
