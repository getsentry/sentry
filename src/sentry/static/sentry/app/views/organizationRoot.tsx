import {withRouter, RouteComponentProps} from 'react-router';
import { Component } from 'react';

import {setActiveProject} from 'app/actionCreators/projects';
import {setLastRoute} from 'app/actionCreators/navigation';

type Props = RouteComponentProps<{}, {}>;

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
