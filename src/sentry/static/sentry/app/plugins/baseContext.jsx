import React from 'react';

import ContextBlock from '../components/events/contexts/contextBlock';

class BaseContext extends React.Component {
  render() {
    return <ContextBlock data={this.props.data} alias={this.props.alias} />;
  }
}

BaseContext.displayName = 'BaseContext';

BaseContext.propTypes = {
  alias: React.PropTypes.string.isRequired,
  data: React.PropTypes.object.isRequired
};

BaseContext.getTitle = function(value) {
  return value;
};

export default BaseContext;
