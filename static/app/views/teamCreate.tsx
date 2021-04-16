import React from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import NarrowLayout from 'app/components/narrowLayout';
import CreateTeamForm from 'app/components/teams/createTeamForm';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

type Props = WithRouterProps<{orgId: string}, {}> & {
  organization: Organization;
};

class TeamCreate extends AsyncView<Props> {
  getTitle() {
    return t('Create Team');
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
          organization={this.props.organization}
        />
      </NarrowLayout>
    );
  }
}

export {TeamCreate};
export default withRouter(withOrganization(TeamCreate));
