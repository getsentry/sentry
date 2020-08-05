import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {t, tct} from 'app/locale';
import {Panel, PanelHeader} from 'app/components/panels';
import {Organization, Team} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import TeamModel from 'app/views/settings/organizationTeams/teamSettings/model';
import Form from 'app/views/settings/components/forms/form';
import teamSettingsFields from 'app/data/forms/teamSettingsFields';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {removeTeam, updateTeamSuccess} from 'app/actionCreators/teams';
import Field from 'app/views/settings/components/forms/field';
import Confirm from 'app/components/confirm';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';

type Props = {
  api: Client;
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

  getTeamsRoute() {
    const isAllTeams = this.props.location.pathname.includes('all-teams/');
    return isAllTeams ? 'all-teams' : 'my-teams';
  }

  handleTeamRename = (resp, model, id) => {
    updateTeamSuccess(resp.slug, resp);
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));

      this.props.router.replace(
        `/organizations/${
          this.props.organization.slug
        }/teams/${this.getTeamsRoute()}/${model.getValue(id)}/settings/`
      );
      this.setState({loading: true});
    }
  };

  handleRemoveTeam = async () => {
    const {team, organization} = this.props;
    await removeTeam(this.props.api, {
      teamId: team.slug,
      orgId: organization.slug,
    });

    this.props.router.replace(
      `/organizations/${this.props.organization.slug}/teams/${this.getTeamsRoute()}/`
    );
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

        <Panel>
          <PanelHeader>{t('Remove Team')}</PanelHeader>
          <Field
            help={t(
              "This may affect team members' access to projects and associated alert delivery."
            )}
          >
            <div>
              <Confirm
                disabled={!access.has('team:admin')}
                onConfirm={this.handleRemoveTeam}
                priority="danger"
                message={tct('Are you sure you want to remove the team [team]?', {
                  team: `#${team.slug}`,
                })}
              >
                <Button
                  icon={<IconDelete />}
                  priority="danger"
                  disabled={!access.has('team:admin')}
                >
                  {t('Remove Team')}
                </Button>
              </Confirm>
            </div>
          </Field>
        </Panel>
      </div>
    );
  }
}

export default ReactRouter.withRouter(withApi(Settings));
