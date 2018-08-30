import React from 'react';

import getDisplayName from 'app/utils/getDisplayName';

import HealthContext from './healthContext';

/**
 * HoC that provides component with properties from `HealthContext`
 */
const withHealth = WrappedComponent => {
  class WithHealth extends React.Component {
    render() {
      return (
        <HealthContext.Consumer>
          {context => <WrappedComponent {...context} {...this.props} />}
        </HealthContext.Consumer>
      );
    }
  }

  WithHealth.displayName = `withHealth(${getDisplayName(WrappedComponent)})`;

  return WithHealth;
};

export default withHealth;
