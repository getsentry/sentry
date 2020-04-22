import {withRouter, WithRouterProps} from 'react-router';
import React from 'react';

import {GlobalSelection, Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withProjectsSpecified from 'app/utils/withProjectsSpecified';

import GlobalSelectionHeader from './globalSelectionHeader';

// TODO(ts): Intersect with types of GlobalSelectionHeader when it is converted to ts
type Props = {
  organization: Organization;
  selection: GlobalSelection;
  projects: Project[];
  loadingProjects: boolean;
} & WithRouterProps &
  React.ComponentProps<typeof GlobalSelectionHeader>;

class GlobalSelectionHeaderContainer extends React.Component<Props> {
  render() {
    return <GlobalSelectionHeader key={this.props.params.slug} {...this.props} />;
  }
}

export default withOrganization(
  withProjectsSpecified(withRouter(withGlobalSelection(GlobalSelectionHeaderContainer)))
);
