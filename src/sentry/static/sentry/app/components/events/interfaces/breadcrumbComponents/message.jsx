import React from 'react';

import Classifier from './classifier';

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
        <Classifier value={data.classifier} title="%s" hideIfEmpty={true}/>
      </p>
    );
  }
});

export default MessageCrumbComponent;
