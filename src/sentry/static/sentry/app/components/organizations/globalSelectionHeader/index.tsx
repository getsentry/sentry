import * as ReactRouter from 'react-router';
import React from 'react';

import {GlobalSelection, Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withProjectsSpecified from 'app/utils/withProjectsSpecified';

import GlobalSelectionHeader from './globalSelectionHeader';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  projects: Project[];
  loadingProjects: boolean;
} & ReactRouter.WithRouterProps &
  React.ComponentProps<typeof GlobalSelectionHeader>;

class GlobalSelectionHeaderContainer extends React.Component<Props> {
  render() {
    return <GlobalSelectionHeader {...this.props} />;
  }
}

export default withOrganization(
  withProjectsSpecified(
    ReactRouter.withRouter(withGlobalSelection(GlobalSelectionHeaderContainer))
  )
);
