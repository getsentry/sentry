import React from 'react';
import * as ReactRouter from 'react-router';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {DATE_TIME_KEYS} from 'app/constants/globalSelectionHeader';
import {
  initializeUrlState,
  updateProjects,
  updateEnvironments,
  updateDateTime,
} from 'app/actionCreators/globalSelection';

import {getStateFromQuery} from './utils';
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
    } = this.props;

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
    });
  }

  componentDidUpdate(prevProps: Props) {
    /**
     * This happens e.g. using browser's navigation button, in which case
     * we need to update our store to reflect URL changes
     */
    if (prevProps.location.query !== this.props.location.query) {
      const oldQuery = getStateFromQuery(prevProps.location.query, {
        allowEmptyPeriod: true,
      });
      const newQuery = getStateFromQuery(this.props.location.query, {
        allowEmptyPeriod: true,
      });

      const newEnvironments = newQuery.environment || [];
      const newDateObject = pick(newQuery, DATE_TIME_KEYS);

      /**
       * Do not pass router to these actionCreators, as we do not want to update
       * routes since these state changes are happening due to a change of routes
       */
      if (!isEqual(oldQuery.project, newQuery.project)) {
        updateProjects(newQuery.project || [], null, {environments: newEnvironments});
      }
      if (!isEqual(oldQuery.environment, newQuery.project)) {
        // Projects changing will also change environments, so only update environments
        // by itself if projects is unchanged
        updateEnvironments(newEnvironments);
      }

      if (!isEqual(pick(oldQuery, DATE_TIME_KEYS), newDateObject)) {
        updateDateTime(newDateObject);
      }
    }
  }

  render() {
    return null;
  }
}

export default InitializeGlobalSelectionHeader;
