import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import EventTitleError from 'sentry/components/eventTitleError';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconStar} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getLocation, getMessage, isTombstone} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

interface EventOrGroupHeaderProps {
  data: Group;
  organization: Organization;
  event_id?: string;
}

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
interface IssueTitleChildrenProps {
  data: Group;
  organization: Organization;
}
function IssueTitleChildren(props: IssueTitleChildrenProps) {
  const {isBookmarked, hasSeen} = props.data;

  return (
    <Fragment>
      {isBookmarked && (
        <IconWrapper>
          <IconStar isSolid color="yellow400" />
        </IconWrapper>
      )}
      <ErrorBoundary customComponent={() => <EventTitleError />} mini>
        <StyledEventOrGroupTitle
          data={props.data}
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
  event_id?: string;
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
        pathname: props.event_id
          ? `/organizations/${organization.slug}/issues/${props.data.id}/events/${props.event_id}/`
          : `/organizations/${organization.slug}/issues/${props.data.id}/`,
      }}
    >
      <IssueTitleChildren data={props.data} organization={organization} />
    </TitleWithLink>
  );
}

export function IssueSummary({data, event_id}: EventOrGroupHeaderProps) {
  const eventLocation = getLocation(data);
  const organization = useOrganization();

  const hasNewLayout = organization.features.includes('issue-stream-table-layout');

  return (
    <div data-test-id="event-issue-header">
      <Title>
        <IssueTitle data={data} event_id={event_id} />
      </Title>
      {eventLocation ? <Location>{eventLocation}</Location> : null}
      {!hasNewLayout ? (
        <StyledEventMessage
          data={data}
          level={'level' in data ? data.level : undefined}
          message={getMessage(data)}
          type={data.type}
          levelIndicatorSize={9}
        />
      ) : null}
    </div>
  );
}

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

function Location(props: any) {
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
  align-items: center;
  ${p => p.theme.overflowEllipsis}
`;
const TitleWithoutLink = styled('span')`
  ${p => p.theme.overflowEllipsis}
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)<{
  hasSeen: boolean;
}>`
  font-weight: ${p => (p.hasSeen ? 400 : 600)};
`;
