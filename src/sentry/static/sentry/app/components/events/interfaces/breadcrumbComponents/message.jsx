import React from 'react';

import Classifier from './classifier';

const MessageCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    let levelClasses = 'level level-' + data.level;

    return (
      <p>
        {data.level ? <span className={levelClasses}>{data.level}</span> : null}
        <span className="message-text">{' ' + data.message + ' '}</span>
        {data.logger ? <span className="logger">[{data.logger}]</span> : null}
        <Classifier value={data.classifier} title="%s" hideIfEmpty={true}/>
      </p>
    );
  }
});

export default MessageCrumbComponent;
