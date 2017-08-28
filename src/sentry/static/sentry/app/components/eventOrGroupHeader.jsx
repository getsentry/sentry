import React, {PropTypes} from 'react';
import classNames from 'classnames';
import {Link} from 'react-router';

import {Metadata} from '../proptypes';
import EventOrGroupTitle from './eventOrGroupTitle';

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
      type: PropTypes.oneOf(['error', 'csp', 'default']).isRequired,
      title: PropTypes.string,
      metadata: Metadata,
      groupID: PropTypes.string,
      culprit: PropTypes.string
    }),
    includeLink: PropTypes.bool,
    hideIcons: PropTypes.bool,
    hideLevel: PropTypes.bool
  };

  static defaultProps = {
    includeLink: true
  };

  getMessage() {
    let {data} = this.props;
    let {metadata, type, culprit} = data || {};

    switch (type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return culprit || '';
    }
  }

  getTitle() {
    let {hideLevel, hideIcons, includeLink, orgId, projectId, data} = this.props;
    let {id, level, groupID} = data || {};
    let isEvent = !!data.eventID;

    let props = {};
    let Wrapper;
    if (includeLink) {
      props.to = `/${orgId}/${projectId}/issues/${isEvent ? groupID : id}/${isEvent ? `events/${data.id}/` : ''}`;
      Wrapper = Link;
    } else {
      Wrapper = 'span';
    }

    return (
      <Wrapper {...props}>
        {!hideLevel && level && <span className="error-level truncate">{level}</span>}
        {!hideIcons && <span className="icon icon-soundoff" />}
        {!hideIcons && <span className="icon icon-star-solid" />}
        <EventOrGroupTitle {...this.props} />
      </Wrapper>
    );
  }

  render() {
    let {className} = this.props;
    let cx = classNames('event-issue-header', className);
    let message = this.getMessage();

    return (
      <div className={cx}>
        <h3 className="truncate">
          {this.getTitle()}
        </h3>
        {message &&
          <div className="event-message truncate">
            <span className="message">{message}</span>
          </div>}
      </div>
    );
  }
}

export default EventOrGroupHeader;
