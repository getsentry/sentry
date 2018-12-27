import {withRouter} from 'react-router';
import React from 'react';

import {setActiveProject} from 'app/actionCreators/projects';
import {setLastRoute} from 'app/actionCreators/navigation';

/**
 * This is the parent container for organization-level views such
 * as the Dashboard, Stats, Activity, etc...
 *
 * Currently is just used to unset active project
 */
class OrganizationRoot extends React.Component {
  componentDidMount() {
    setActiveProject(null);
  }
  componentWillUnmount() {
    let {location} = this.props;
    let {pathname, search} = location;
    // Save last route so that we can jump back to view from settings
    setLastRoute(`${pathname}${search || ''}`);
  }

  render() {
    return this.props.children;
  }
}

export {OrganizationRoot};
export default withRouter(OrganizationRoot);
