import {withRouter, WithRouterProps} from 'react-router';

import NarrowLayout from 'sentry/components/narrowLayout';
import CreateTeamForm from 'sentry/components/teams/createTeamForm';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

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

  handleSubmitSuccess = (data: {slug: string}) => {
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
