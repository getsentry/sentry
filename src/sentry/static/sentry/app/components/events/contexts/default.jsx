import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

class DefaultContextType extends React.Component {
  static propTypes = {
    alias: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  render() {
    return <ContextBlock data={this.props.data} alias={this.props.alias} />;
  }
}

export default DefaultContextType;
