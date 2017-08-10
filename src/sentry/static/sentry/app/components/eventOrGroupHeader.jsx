import React, {PropTypes} from 'react';
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
    hideLevel: PropTypes.bool
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

  render() {
    let {hideLevel, orgId, projectId, data} = this.props;
    let {id, level, groupID} = data || {};
    let isEvent = !!data.eventID;
    let url = `/${orgId}/${projectId}/issues/${isEvent ? groupID : id}/${isEvent ? `events/${data.id}/` : ''}`;
    let message = this.getMessage();

    return (
      <div className="event-issue-header">
        <h3 className="truncate">
          <Link to={url}>
            {!hideLevel && level && <span className="error-level truncate">{level}</span>}
            <span className="icon icon-soundoff" />
            <span className="icon icon-star-solid" />
            <EventOrGroupTitle {...this.props} />
          </Link>
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
