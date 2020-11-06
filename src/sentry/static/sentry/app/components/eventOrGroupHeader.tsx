import React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {css} from '@emotion/core';
import capitalize from 'lodash/capitalize';

import {tct} from 'app/locale';
import {Event, Group, GroupTombstone, Level} from 'app/types';
import {IconMute, IconStar} from 'app/icons';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import Tooltip from 'app/components/tooltip';
import {getMessage, getLocation} from 'app/utils/events';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import UnhandledTag, {
  TagAndMessageWrapper,
} from 'app/views/organizationGroupDetails/unhandledTag';

type DefaultProps = {
  includeLink: boolean;
  size: 'small' | 'normal';
};

type Props = WithRouterProps<{orgId: string}> & {
  data: Event | Group | GroupTombstone;
  hideIcons?: boolean;
  hideLevel?: boolean;
  query?: string;
  className?: string;
} & DefaultProps;

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
class EventOrGroupHeader extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    includeLink: true,
    size: 'normal',
  };

  getTitleChildren() {
    const {hideIcons, hideLevel, data} = this.props;
    const {level, status, isBookmarked, hasSeen} = data as Group;

    return (
      <React.Fragment>
        {!hideLevel && level && (
          <GroupLevel level={level}>
            <Tooltip title={`Error level: ${capitalize(level)}`}>
              <span />
            </Tooltip>
          </GroupLevel>
        )}
        {!hideIcons && status === 'ignored' && (
          <IconWrapper>
            <IconMute color="red400" />
          </IconWrapper>
        )}
        {!hideIcons && isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="orange300" />
          </IconWrapper>
        )}
        <EventOrGroupTitle {...this.props} style={{fontWeight: hasSeen ? 400 : 600}} />
      </React.Fragment>
    );
  }

  getTitle() {
    const {includeLink, data, params, location} = this.props;

    const orgId = params?.orgId;

    const {id, status} = data as Group;
    const {eventID, groupID} = data as Event;

    const props = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
      style: status === 'resolved' ? {textDecoration: 'line-through'} : undefined,
    };

    if (includeLink) {
      return (
        <GlobalSelectionLink
          {...props}
          to={{
            pathname: `/organizations/${orgId}/issues/${eventID ? groupID : id}/${
              eventID ? `events/${eventID}/` : ''
            }`,
            query: {
              query: this.props.query,
              ...(location.query.sort !== undefined ? {sort: location.query.sort} : {}), // This adds sort to the query if one was selected from the issues list page
              ...(location.query.project !== undefined ? {} : {_allp: 1}), //This appends _allp to the URL parameters if they have no project selected ("all" projects included in results). This is so that when we enter the issue details page and lock them to a project, we can properly take them back to the issue list page with no project selected (and not the locked project selected)
            },
          }}
        >
          {this.getTitleChildren()}
        </GlobalSelectionLink>
      );
    } else {
      return <span {...props}>{this.getTitleChildren()}</span>;
    }
  }

  render() {
    const {className, size, data} = this.props;
    const location = getLocation(data);
    const message = getMessage(data);
    const {isUnhandled} = data as Group;

    return (
      <div className={className} data-test-id="event-issue-header">
        <Title size={size}>{this.getTitle()}</Title>
        {location && <Location size={size}>{location}</Location>}
        {(message || isUnhandled) && (
          <StyledTagAndMessageWrapper size={size}>
            {isUnhandled && <UnhandledTag />}
            {message && <Message>{message}</Message>}
          </StyledTagAndMessageWrapper>
        )}
      </div>
    );
  }
}

const truncateStyles = css`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const getMargin = ({size}) => {
  if (size === 'small') {
    return 'margin: 0;';
  }

  return 'margin: 0 0 5px';
};

const Title = styled('div')`
  ${truncateStyles};
  ${getMargin};
  & em {
    font-size: ${p => p.theme.fontSizeMedium};
    font-style: normal;
    font-weight: 300;
    color: ${p => p.theme.gray600};
  }
`;

const LocationWrapper = styled('div')`
  ${truncateStyles};
  ${getMargin};
  direction: rtl;
  text-align: left;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
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
`;

const Message = styled('div')`
  ${truncateStyles};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IconWrapper = styled('span')`
  position: relative;
  top: 2px;

  margin-right: 5px;
`;

const GroupLevel = styled('div')<{level: Level}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    switch (p.level) {
      case 'sample':
        return p.theme.purple400;
      case 'info':
        return p.theme.blue400;
      case 'warning':
        return p.theme.yellow300;
      case 'error':
        return p.theme.orange400;
      case 'fatal':
        return p.theme.red400;
      default:
        return p.theme.gray500;
    }
  }};

  & span {
    display: block;
    width: 9px;
    height: 15px;
  }
`;

export default withRouter(EventOrGroupHeader);
