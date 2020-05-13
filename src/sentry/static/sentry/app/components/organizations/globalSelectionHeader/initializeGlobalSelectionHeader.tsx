import React from 'react';
import * as ReactRouter from 'react-router';

import {initializeUrlState} from 'app/actionCreators/globalSelection';

import GlobalSelectionHeader from './globalSelectionHeader';

type Props = {
  isDisabled: boolean;
  shouldEnforceSingleProject: boolean;
  /**
   * Skip loading from local storage
   * An example is Issue Details, in the case where it is accessed directly (e.g. from email).
   * We do not want to load the user's last used env/project in this case, otherwise will
   * lead to very confusing behavior.
   */
  skipLoadLastUsed: boolean;
} & Pick<ReactRouter.WithRouterProps, 'location' | 'router'> &
  Pick<
    React.ComponentPropsWithoutRef<typeof GlobalSelectionHeader>,
    | 'defaultSelection'
    | 'forceProject'
    | 'shouldForceProject'
    | 'memberProjects'
    | 'organization'
    | 'showAbsolute'
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
      organization,
      defaultSelection,
      forceProject,
      memberProjects,
      shouldForceProject,
      shouldEnforceSingleProject,
      skipLoadLastUsed,
      showAbsolute,
    } = this.props;

    //
    initializeUrlState({
      organization,
      queryParams: location.query,
      router,
      skipLoadLastUsed,
      memberProjects,
      defaultSelection,
      forceProject,
      shouldForceProject,
      shouldEnforceSingleProject,
      showAbsolute,
    });
  }

  render() {
    return null;
  }
}

export default InitializeGlobalSelectionHeader;
