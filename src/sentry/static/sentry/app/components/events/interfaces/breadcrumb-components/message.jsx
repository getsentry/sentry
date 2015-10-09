import React from "react";

var MessageCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var data = this.props.data;
    return (
      <p>
        {data.level ? <span className="level">{data.level}</span> : null}
        {' ' + data.message + ' '}
        {data.logger ? <span className="logger">[{data.logger}]</span> : null}
      </p>
    );
  }
});

export default MessageCrumbComponent;
