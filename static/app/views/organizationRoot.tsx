import {Fragment, useEffect} from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {setLastRoute} from 'sentry/actionCreators/navigation';
import {setActiveProject} from 'sentry/actionCreators/projects';

type Props = WithRouterProps & {children: React.ReactChildren};

/**
 * This is the parent container for organization-level views such
 * as the Dashboard, Stats, Activity, etc...
 *
 * Currently is just used to unset active project
 */
function OrganizationRoot({children, location}: Props) {
  useEffect(() => {
    setActiveProject(null);

    return () => setLastRoute(`${location.pathname}${location.search ?? ''}`);
  }, []);

  return <Fragment>{children}</Fragment>;
}

export default withRouter(OrganizationRoot);
