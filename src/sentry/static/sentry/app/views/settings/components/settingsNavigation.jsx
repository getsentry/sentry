import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import SettingsNavigationGroup from '../components/settingsNavigationGroup';
import SentryTypes from '../../../proptypes';

class SettingsNavigation extends React.Component {
  static propTypes = {
    hooks: PropTypes.array.isRequired,
    navigationObjects: PropTypes.arrayOf(SentryTypes.NavigationObject).isRequired,
  };

  static defaultProps = {
    hooks: [],
  };

  render() {
    let {navigationObjects, hooks, ...otherProps} = this.props;
    let navWithHooks = navigationObjects.concat(hooks);

    return (
      <Box>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
      </Box>
    );
  }
}

export default SettingsNavigation;
