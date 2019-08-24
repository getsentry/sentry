import PropTypes from 'prop-types';
import React from 'react';

import EventMessage from 'app/components/events/eventMessage';

class SharedGroupHeader extends React.Component {
  static propTypes = {
    group: PropTypes.object.isRequired,
  };

  render() {
    const group = this.props.group;

    return (
      <div className="group-detail" style={{paddingBottom: 20}}>
        <div className="details">
          <h3>{group.title}</h3>

          <EventMessage message={group.culprit} />
        </div>
      </div>
    );
  }
}

export default SharedGroupHeader;
