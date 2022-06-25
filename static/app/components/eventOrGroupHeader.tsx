import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import Tooltip from 'sentry/components/tooltip';
import {IconMute, IconStar} from 'sentry/icons';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, GroupTombstone, Level} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getLocation, getMessage} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {TagAndMessageWrapper} from 'sentry/views/organizationGroupDetails/unhandledTag';

import EventTitleError from './eventTitleError';

type Size = 'small' | 'normal';

type Props = {
  data: Event | Group | GroupTombstone;
  className?: string;
  /* is issue breakdown? */
  grouping?: boolean;
  hideIcons?: boolean;
  hideLevel?: boolean;
  includeLink?: boolean;
  index?: number;
  /** Group link clicked */
  onClick?: () => void;
  query?: string;
  size?: Size;
};

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
function EventOrGroupHeader({
  data,
  index,
  query,
  onClick,
  className,
  hideIcons,
  hideLevel,
  includeLink = true,
  size = 'normal',
  grouping = false,
}: Props) {
  const params = useParams();
  const location = useLocation();
  const organization = useOrganization();
  const hasGroupingTreeUI = !!organization.features?.includes('grouping-tree-ui');

  function getTitleChildren() {
    const {level, status, isBookmarked, hasSeen} = data as Group;
    return (
      <Fragment>
        {!hideLevel && level && (
          <GroupLevel level={level}>
            <Tooltip title={tct('Error level: [level]', {level: capitalize(level)})}>
              <span />
            </Tooltip>
          </GroupLevel>
        )}
        {!hideIcons && status === 'ignored' && (
          <IconWrapper>
            <IconMute color="red300" />
          </IconWrapper>
        )}
        {!hideIcons && isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="yellow300" />
          </IconWrapper>
        )}
        <ErrorBoundary customComponent={<EventTitleError />} mini>
          <StyledEventOrGroupTitle
            data={data}
            organization={organization}
            hasSeen={hasGroupingTreeUI && hasSeen === undefined ? true : hasSeen}
            withStackTracePreview
            hasGuideAnchor={index === 0}
            grouping={grouping}
          />
        </ErrorBoundary>
      </Fragment>
    );
  }

  function getTitle() {
    const orgId = params?.orgId;

    const {id, status} = data as Group;
    const {eventID, groupID} = data as Event;

    const commonEleProps = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
      style: status === 'resolved' ? {textDecoration: 'line-through'} : undefined,
    };

    if (includeLink) {
      return (
        <GlobalSelectionLink
          {...commonEleProps}
          to={{
            pathname: `/organizations/${orgId}/issues/${eventID ? groupID : id}/${
              eventID ? `events/${eventID}/` : ''
            }`,
            query: {
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
        </GlobalSelectionLink>
      );
    }

    return <span {...commonEleProps}>{getTitleChildren()}</span>;
  }

  const eventLocation = getLocation(data);
  const message = getMessage(data);

  return (
    <div className={className} data-test-id="event-issue-header">
      <Title size={size} hasGroupingTreeUI={hasGroupingTreeUI}>
        {getTitle()}
      </Title>
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

const Title = styled('div')<{hasGroupingTreeUI: boolean; size: Size}>`
  line-height: 1;
  margin-bottom: ${space(0.25)};
  & em {
    font-size: ${p => p.theme.fontSizeMedium};
    font-style: normal;
    font-weight: 300;
    color: ${p => p.theme.subText};
  }
  ${p =>
    !p.hasGroupingTreeUI
      ? css`
          ${truncateStyles}
        `
      : css`
          > a:first-child {
            display: flex;
            min-height: ${space(3)};
          }
        `}
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
  display: flex;
  margin-right: 5px;
`;

const GroupLevel = styled('div')<{level: Level}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => p.theme.level[p.level] ?? p.theme.level.default};

  & span {
    display: block;
    width: 9px;
    height: 15px;
  }
`;

export default EventOrGroupHeader;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)<{
  hasSeen: boolean;
}>`
  font-weight: ${p => (p.hasSeen ? 400 : 600)};
`;
