import React from 'react';
import * as ReactRouter from 'react-router';

import {initializeUrlState} from 'app/actionCreators/globalSelection';

import GlobalSelectionHeader from './globalSelectionHeader';

type Props = {
  isDisabled: boolean;
  shouldEnforceSingleProject: boolean;
} & Pick<ReactRouter.WithRouterProps, 'location' | 'router' | 'routes'> &
  Pick<
    React.ComponentPropsWithoutRef<typeof GlobalSelectionHeader>,
    | 'defaultSelection'
    | 'forceProject'
    | 'shouldForceProject'
    | 'memberProjects'
    | 'organization'
  >;

/**
 * Initializes GlobalSelectionHeader
 *
 * Calls an actionCreator to load project/environment from local storage if possible,
 * otherwise populate with defaults.
 *
 * This should only happen when the header is mounted
 * e.g. when changing views or organizations.
 */
class InitializeGlobalSelectionHeader extends React.Component<Props> {
  componentDidMount() {
    const {
      location,
      router,
      routes,
      organization,
      defaultSelection,
      forceProject,
      memberProjects,
      shouldForceProject,
      shouldEnforceSingleProject,
    } = this.props;

    // Make an exception for issue details in the case where it is accessed directly (e.g. from email)
    // We do not want to load the user's last used env/project in this case, otherwise will
    // lead to very confusing behavior.
    //
    // `routes` is only ever undefined in tests
    const skipLastUsed = !!routes?.find(
      ({path}) => path && path.includes('/organizations/:orgId/issues/:groupId/')
    );
    initializeUrlState({
      organization,
      queryParams: location.query,
      router,
      skipLastUsed,
      memberProjects,
      defaultSelection,
      forceProject,
      shouldForceProject,
      shouldEnforceSingleProject,
    });
  }

  render() {
    return null;
  }
}

export default InitializeGlobalSelectionHeader;
