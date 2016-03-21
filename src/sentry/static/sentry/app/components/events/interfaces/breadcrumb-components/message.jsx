import React from 'react';

const MessageCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
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
