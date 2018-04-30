import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import classNames from 'classnames';
import {capitalize} from 'lodash';

import ProjectLink from 'app/components/projectLink';
import {Metadata} from 'app/proptypes';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import Tooltip from 'app/components/tooltip';

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
class EventOrGroupHeader extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    /** Either an issue or event **/
    data: PropTypes.shape({
      id: PropTypes.string,
      level: PropTypes.string,
      type: PropTypes.oneOf([
        'error',
        'csp',
        'hpkp',
        'expectct',
        'expectstaple',
        'default',
      ]).isRequired,
      title: PropTypes.string,
      metadata: Metadata,
      groupID: PropTypes.string,
      culprit: PropTypes.string,
    }),
    includeLink: PropTypes.bool,
    hideIcons: PropTypes.bool,
    hideLevel: PropTypes.bool,
    query: PropTypes.string,
  };

  static defaultProps = {
    includeLink: true,
  };

  getMessage() {
    let {data} = this.props;
    let {metadata, type, culprit} = data || {};

    switch (type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      case 'expectct':
      case 'expectstaple':
      case 'hpkp':
        return '';
      default:
        return culprit || '';
    }
  }

  getTitle() {
    let {hideIcons, hideLevel, includeLink, orgId, projectId, data} = this.props;
    let {id, level, groupID} = data || {};
    let isEvent = !!data.eventID;

    let props = {};
    let Wrapper;
    if (includeLink) {
      props.to = {
        pathname: `/${orgId}/${projectId}/issues/${isEvent ? groupID : id}/${isEvent
          ? `events/${data.id}/`
          : ''}`,
        search: `${this.props.query ? `?query=${this.props.query}` : ''}`,
      };
      Wrapper = ProjectLink;
    } else {
      Wrapper = 'span';
    }

    return (
      <Wrapper
        {...props}
        style={data.status === 'resolved' ? {textDecoration: 'line-through'} : null}
      >
        {!hideLevel &&
          level && (
            <Tooltip title={`Error level: ${capitalize(level)}`}>
              <GroupLevel level={data.level} />
            </Tooltip>
          )}
        {!hideIcons && data.status === 'ignored' && <Muted className="icon-soundoff" />}
        {!hideIcons && data.isBookmarked && <Starred className="icon-star-solid" />}
        <EventOrGroupTitle
          {...this.props}
          style={{fontWeight: data.hasSeen ? 400 : 600}}
        />
      </Wrapper>
    );
  }

  render() {
    let {className} = this.props;
    let cx = classNames('event-issue-header', className);
    let message = this.getMessage();

    return (
      <div className={cx}>
        <Title>{this.getTitle()}</Title>
        {message && <Message>{message}</Message>}
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

const Title = styled.div`
  ${truncateStyles};
  margin: 0 0 5px;
  & em {
    font-size: 14px;
    font-style: normal;
    font-weight: 300;
    color: ${p => p.theme.gray3};
  }
`;

const Message = styled.div`
  ${truncateStyles};
  font-size: 14px;
  margin: 0 0 5px;
`;

const iconStyles = css`
  font-size: 14px;
  margin-right: 5px;
`;

const Muted = styled.span`
  ${iconStyles};
  color: ${p => p.theme.red};
`;

const Starred = styled.span`
  ${iconStyles};
  color: ${p => p.theme.yellowOrange};
`;

const GroupLevel = styled.div`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    switch (p.level) {
      case 'sample':
        return p.theme.purple;
      case 'info':
        return p.theme.blue;
      case 'warning':
        return p.theme.yellowOrange;
      case 'error':
        return p.theme.orange;
      case 'fatal':
        return p.theme.red;
      default:
        return p.theme.gray2;
    }
  }};
`;

export default EventOrGroupHeader;
