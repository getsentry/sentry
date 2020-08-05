import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {t, tct} from 'app/locale';
import {Organization, Team} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import TeamModel from 'app/views/settings/organizationTeams/teamSettings/model';
import Form from 'app/views/settings/components/forms/form';
import teamSettingsFields from 'app/data/forms/teamSettingsFields';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {removeTeam, updateTeamSuccess} from 'app/actionCreators/teams';

type Props = {
  location: Location;
  team: Team;
  organization: Organization;
} & ReactRouter.WithRouterProps;

class Settings extends React.Component<Props> {
  constructor(props: Props, context) {
    super(props, context);

    this.model = new TeamModel();
    this.model.teamId = props.team.slug;
    this.model.orgId = props.organization.slug;
  }

  // TODO: needs a type
  model: any = undefined;

  handleTeamRename = (resp, model, id) => {
    updateTeamSuccess(resp.slug, resp);
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));

      const isAllTeams = location.pathname.includes('all-teams/');

      const teamsRoute = isAllTeams ? 'all-teams' : 'my-teams';

      this.props.router.replace(
        `/organizations/${
          this.props.organization.slug
        }/teams/${teamsRoute}/${model.getValue(id)}/settings/`
      );
      this.setState({loading: true});
    }
  };

  render() {
    const {organization, location, team} = this.props;
    const access = new Set(organization.access);

    return (
      <div>
        <Form
          model={this.model}
          apiMethod="PUT"
          saveOnBlur
          allowUndo
          onSubmitSuccess={this.handleTeamRename}
          onSubmitError={() => addErrorMessage(t('Unable to save change'))}
          initialData={{
            name: team.name,
            slug: team.slug,
          }}
        >
          <JsonForm access={access} location={location} forms={teamSettingsFields} />
        </Form>
      </div>
    );
  }
}

export default ReactRouter.withRouter(Settings);
