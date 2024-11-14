import {Fragment, useEffect} from 'react';

import {setActiveProject} from 'sentry/actionCreators/projects';

type Props = {children: React.ReactNode};

/**
 * This is the parent container for organization-level views such
 * as the Dashboard, Stats, Activity, etc...
 *
 * Currently is just used to unset active project
 */
function OrganizationRoot({children}: Props) {
  useEffect(() => void setActiveProject(null), []);

  return <Fragment>{children}</Fragment>;
}

export default OrganizationRoot;
