import PropTypes from 'prop-types';
import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

class DefaultContextType extends React.Component {
  static propTypes = {
    alias: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  render() {
    const knownData = Object.entries(this.props.data)
      .filter(([k]) => k !== 'type' && k !== 'title')
      .map(([k, v]) => {
        return {
          key: k,
          subject: k,
          value: v,
        };
      });

    return <ContextBlock knownData={knownData} alias={this.props.alias} />;
  }
}

export default DefaultContextType;
