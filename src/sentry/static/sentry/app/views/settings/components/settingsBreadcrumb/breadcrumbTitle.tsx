import React from 'react';
import {PlainRoute} from 'react-router/lib/Route';

import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';

type Props = {
  routes: Array<PlainRoute>;
  title: string;
};

class BreadcrumbTitle extends React.Component<Props> {
  componentDidMount() {
    SettingsBreadcrumbActions.mapTitle(this.props);
  }

  render() {
    return null;
  }
}

export default BreadcrumbTitle;
