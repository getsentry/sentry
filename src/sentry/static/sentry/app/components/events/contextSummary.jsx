import React from 'react';

import PropTypes from '../../proptypes';
import {objectIsEmpty} from '../../utils';

const EventContextSummary = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
  },

  render() {
    let evt = this.props.event;
    let user = evt.user;

    let userTitle = (!objectIsEmpty(user) && user.email ?
      user.email :
      user.ipAddress || user.id || user.username);

    return (
      <div className="context-summary">
        {userTitle ?
          <div className="context-item">
            <span className="icon" />
            <h3>{userTitle}</h3>
            {user.id && user.id !== userTitle ?
              <p><strong>ID:</strong> {user.id}</p>
            : (user.username && user.username !== userTitle &&
              <p><strong>Username:</strong> {user.username}</p>
            )}
          </div>
        :
          <div className="context-item">
            <span className="icon" />
            <h3>Unknown User</h3>
          </div>
        }
        <div className="context-item android">
          <span className="icon" />
          <h3>iPod 5 (n78ap)</h3>
          <p><strong>Architecture:</strong> armv7f</p>
        </div>
        <div className="context-item ios">
          <span className="icon" />
          <h3>iOS 8.3 (12F69)</h3>
          <p>Darwin Kernel Version 14.0.0</p>
        </div>
      </div>
    );
  }
});

export default EventContextSummary;
