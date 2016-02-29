import React from 'react';

const SharedGroupHeader = React.createClass({
  propTypes: {
    group: React.PropTypes.object.isRequired
  },

  render() {
    let group = this.props.group;

    return (
      <div className="group-detail" style={{paddingBottom: 20}}>
        <div className="details">
          <h3>
            {group.title}
          </h3>
          <div className="event-message">
            <span className="message">{group.culprit}</span>
          </div>
        </div>
      </div>
    );
  }
});

export default SharedGroupHeader;
