import {RouteComponentProps} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import React from 'react';

import {Config} from 'app/types';
import {DEFAULT_APP_ROUTE} from 'app/constants';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withConfig from 'app/utils/withConfig';

type Props = {
  config: Config;
} & RouteComponentProps<{}, {}>;

/**
 * This view is used when a user lands on the route `/` which historically
 * is a server-rendered route which redirects the user to their last selected organization
 *
 * However, this does not work when in the experimental SPA mode (e.g. developing against a remote API,
 * or a deploy preview), so we must replicate the functionality and redirect
 * the user to the proper organization.
 *
 * TODO: There might be an edge case where user does not have `lastOrganization` set,
 * in which case we should load their list of organizations and make a decision
 */
class AppRoot extends React.Component<Props> {
  componentDidMount() {
    const {config} = this.props;

    if (config.lastOrganization) {
      browserHistory.replace(
        replaceRouterParams(DEFAULT_APP_ROUTE, {orgSlug: config.lastOrganization})
      );
    }
  }

  render() {
    return null;
  }
}

export default withConfig(AppRoot);
