import React from 'react';

import ContextBlock from './contextBlock';

const DefaultContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    return (
      <ContextBlock data={this.props.data} alias={this.props.alias} />
    );
  }
});

export default DefaultContextType;
