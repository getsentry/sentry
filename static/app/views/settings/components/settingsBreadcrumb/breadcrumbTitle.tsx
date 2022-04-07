import {Component} from 'react';
import {PlainRoute} from 'react-router';

import SettingsBreadcrumbStore from 'sentry/stores/settingsBreadcrumbStore';

type Props = {
  routes: Array<PlainRoute>;
  title: string;
};

class BreadcrumbTitle extends Component<Props> {
  componentDidMount() {
    SettingsBreadcrumbStore.updateRouteMap(this.props);
  }

  render() {
    return null;
  }
}

export default BreadcrumbTitle;
