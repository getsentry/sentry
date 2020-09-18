import PropTypes from 'prop-types';
import React from 'react';
import {withRouter} from 'react-router';
import styled from '@emotion/styled';
import {css} from '@emotion/core';
import capitalize from 'lodash/capitalize';

import {IconMute, IconStar} from 'app/icons';
import SentryTypes from 'app/sentryTypes';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import Tooltip from 'app/components/tooltip';
import {getMessage, getLocation} from 'app/utils/events';
import GlobalSelectionLink from 'app/components/globalSelectionLink';

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
class EventOrGroupHeader extends React.Component {
  static propTypes = {
    params: PropTypes.object,
    /** Either an issue or event **/
    data: PropTypes.oneOfType([SentryTypes.Event, SentryTypes.Group]),
    includeLink: PropTypes.bool,
    hideIcons: PropTypes.bool,
    hideLevel: PropTypes.bool,
    query: PropTypes.string,
    size: PropTypes.oneOf(['small', 'normal']),
  };

  static defaultProps = {
    includeLink: true,
    size: 'normal',
  };

  getTitle() {
    const {hideIcons, hideLevel, includeLink, data, params, location} = this.props;

    const orgId = params?.orgId;

    const {id, level, groupID} = data || {};
    const isEvent = !!data.eventID;

    const props = {};
    let Wrapper;

    const basePath = `/organizations/${orgId}/issues/`;

    if (includeLink) {
      const query = {
        query: this.props.query,
        ...(location.query.sort !== undefined ? {sort: location.query.sort} : {}), // This adds sort to the query if one was selected from the issues list page
        ...(location.query.project !== undefined ? {} : {_allp: 1}), //This appends _allp to the URL parameters if they have no project selected ("all" projects included in results). This is so that when we enter the issue details page and lock them to a project, we can properly take them back to the issue list page with no project selected (and not the locked project selected)
      };

      props.to = {
        pathname: `${basePath}${isEvent ? groupID : id}/${
          isEvent ? `events/${data.eventID}/` : ''
        }`,
        query,
      };

      Wrapper = GlobalSelectionLink;
    } else {
      Wrapper = 'span';
    }

    return (
      <Wrapper
        {...props}
        data-test-id={data.status === 'resolved' ? 'resolved-issue' : null}
        style={data.status === 'resolved' ? {textDecoration: 'line-through'} : null}
      >
        {!hideLevel && level && (
          <GroupLevel level={data.level}>
            <Tooltip title={`Error level: ${capitalize(level)}`}>
              <span />
            </Tooltip>
          </GroupLevel>
        )}
        {!hideIcons && data.status === 'ignored' && (
          <IconWrapper>
            <IconMute color="red400" />
          </IconWrapper>
        )}
        {!hideIcons && data.isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="orange300" />
          </IconWrapper>
        )}
        <EventOrGroupTitle
          {...this.props}
          style={{fontWeight: data.hasSeen ? 400 : 600}}
        />
      </Wrapper>
    );
  }

  render() {
    const {className, size, data} = this.props;
    const location = getLocation(data);
    const message = getMessage(data);

    return (
      <div className={className} data-test-id="event-issue-header">
        <Title size={size}>{this.getTitle()}</Title>
        {location && <Location size={size}>{location}</Location>}
        {message && <Message size={size}>{message}</Message>}
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
    font-size: 14px;
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
  font-size: 14px;
  color: ${p => p.theme.gray600};
  span {
    direction: ltr;
  }
`;

function Location(props) {
  const {children, ...rest} = props;
  return (
    <LocationWrapper {...rest}>
      in <span>{children}</span>
    </LocationWrapper>
  );
}

const Message = styled('div')`
  ${truncateStyles};
  ${getMargin};
  font-size: 14px;
`;

const IconWrapper = styled('span')`
  position: relative;
  top: 2px;

  margin-right: 5px;
`;

const GroupLevel = styled('div')`
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
        return p.theme.yellow400;
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
