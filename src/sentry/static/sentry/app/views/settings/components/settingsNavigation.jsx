import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import SettingsNavigationGroup from 'app/views/settings/components/settingsNavigationGroup';
import SentryTypes from 'app/sentryTypes';
import HookStore from 'app/stores/hookStore';
import logExperiment from 'app/utils/logExposure';

class SettingsNavigation extends React.Component {
  static propTypes = {
    hooks: PropTypes.array,
    hookConfigs: PropTypes.array,
    navigationObjects: PropTypes.arrayOf(SentryTypes.NavigationObject).isRequired,
    organization: SentryTypes.Organization,
  };

  static defaultProps = {
    hooks: [],
    hookConfigs: [],
  };

  componentDidMount() {
    let {organization} = this.props;
    if (!organization || !organization.experiments) return;

    //Experiment exposure is already assigned - this logs the exposure i.e. when the user gets to the settings page
    logExperiment('SSOPaywallExperiment', organization.experiments,
      {unit_name: 'org_id', unit_id: organization.id, params: 'exposed'} )

  }

  render() {
    let {navigationObjects, hooks, hookConfigs, ...otherProps} = this.props;
    let navWithHooks = navigationObjects.concat(hookConfigs);

    return (
      <Box>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) =>
          React.cloneElement(Hook, {
            key: `hook-${i}`,
          })
        )}
      </Box>
    );
  }
}

export default SettingsNavigation;
