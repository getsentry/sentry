import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

class DefaultContextType extends React.Component {
  static propTypes = {
    alias: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  getKnownData() {
    return Object.entries(this.props.data)
      .filter(([k]) => k !== 'type' && k !== 'title')
      .map(([k, v]) => ({
        key: k,
        subject: k,
        value: v,
      }));
  }

  render() {
    return <ContextBlock data={this.getKnownData()} alias={this.props.alias} />;
  }
}

export default DefaultContextType;
