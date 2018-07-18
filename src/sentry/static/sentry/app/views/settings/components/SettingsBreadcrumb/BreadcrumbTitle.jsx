import React from 'react';
import PropTypes from 'prop-types';

import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';

class BreadcrumbTitle extends React.Component {
  static propTypes = {
    routes: PropTypes.array.isRequired, // eslint-disable-line react/no-unused-prop-types
    title: PropTypes.string.isRequired, // eslint-disable-line react/no-unused-prop-types
  };

  componentDidMount() {
    SettingsBreadcrumbActions.mapTitle(this.props);
  }

  render() {
    return null;
  }
}

export default BreadcrumbTitle;
