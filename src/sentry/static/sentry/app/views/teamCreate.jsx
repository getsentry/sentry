import {withRouter} from 'react-router';
import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import CreateTeamForm from 'app/components/createTeamForm';
import NarrowLayout from 'app/components/narrowLayout';
import SentryTypes from 'app/sentryTypes';

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
    const {orgId} = this.props.params;
    const redirectUrl = `/settings/${orgId}/teams/${data.slug}/`;
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
