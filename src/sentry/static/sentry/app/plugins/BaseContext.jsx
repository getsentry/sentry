import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

class BaseContext extends React.Component {
  render() {
    return <ContextBlock data={this.props.data} alias={this.props.alias} />;
  }
}

BaseContext.displayName = 'BaseContext';

BaseContext.propTypes = {
  alias: PropTypes.string.isRequired,
  data: PropTypes.object.isRequired,
};

BaseContext.getTitle = function(value) {
  return value;
};

export default BaseContext;
