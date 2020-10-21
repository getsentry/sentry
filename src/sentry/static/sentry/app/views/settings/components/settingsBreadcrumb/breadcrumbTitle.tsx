import { Component } from 'react';
import {PlainRoute} from 'react-router/lib/Route';

import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';

type Props = {
  routes: Array<PlainRoute>;
  title: string;
};

class BreadcrumbTitle extends Component<Props> {
  componentDidMount() {
    SettingsBreadcrumbActions.mapTitle(this.props);
  }

  render() {
    return null;
  }
}

export default BreadcrumbTitle;
