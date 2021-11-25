import {Component} from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {setLastRoute} from 'sentry/actionCreators/navigation';
import {setActiveProject} from 'sentry/actionCreators/projects';

type Props = WithRouterProps;

/**
 * This is the parent container for organization-level views such
 * as the Dashboard, Stats, Activity, etc...
 *
 * Currently is just used to unset active project
 */
class OrganizationRoot extends Component<Props> {
  componentDidMount() {
    setActiveProject(null);
  }

  componentWillUnmount() {
    const {location} = this.props;
    const {pathname, search} = location;
    // Save last route so that we can jump back to view from settings
    setLastRoute(`${pathname}${search || ''}`);
  }

  render() {
    return this.props.children;
  }
}

export {OrganizationRoot};
export default withRouter(OrganizationRoot);
