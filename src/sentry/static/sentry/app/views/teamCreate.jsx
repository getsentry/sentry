import {withRouter} from 'react-router';
import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import CreateTeamForm from 'app/components/createTeam/createTeamForm';
import NarrowLayout from 'app/components/narrowLayout';
import SentryTypes from 'app/proptypes';

class TeamCreate extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getTitle() {
    return 'Create Team';
  }

  getEndpoints() {
    return [];
  }

  handleSubmitSuccess = data => {
    let features = new Set(this.context.organization.features);

    let {orgId} = this.props.params;

    // Legacy behavior: redirect to project creation
    let redirectUrl = `/organizations/${orgId}/projects/new/?team=${data.slug}`;
    if (features.has('new-teams')) {
      // New behavior: redirect to team settings page
      redirectUrl = `/settings/${orgId}/teams/${data.slug}/`;
    }
    this.props.router.push(redirectUrl);
  };

  renderBody() {
    return (
      <NarrowLayout>
        <h3>{t('Create a New Team')}</h3>

        <CreateTeamForm
          onSuccess={this.handleSubmitSuccess}
          organization={this.context.organization}
        />
      </NarrowLayout>
    );
  }
}

export {TeamCreate};
export default withRouter(TeamCreate);
