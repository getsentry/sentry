import {Component} from 'react';
import {PlainRoute} from 'react-router';

import SettingsBreadcrumbActions from 'sentry/actions/settingsBreadcrumbActions';

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
