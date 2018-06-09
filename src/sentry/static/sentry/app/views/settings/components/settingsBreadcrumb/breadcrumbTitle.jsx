import React from 'react';
import PropTypes from 'prop-types';
import withSideEffect from 'react-side-effect';

import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';

class BreadcrumbTitle extends React.Component {
  static propTypes = {
    routes: PropTypes.array.isRequired,
    title: PropTypes.string.isRequired,
  };

  render() {
    return null;
  }
}

export default withSideEffect(
  p => p,
  propsList => {
    if (propsList.length === 0) return;
    SettingsBreadcrumbActions.mapTitle(propsList[propsList.length - 1]);
  }
)(BreadcrumbTitle);
