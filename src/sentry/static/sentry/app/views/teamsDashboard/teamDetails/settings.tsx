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
import TextField from 'app/views/settings/components/forms/textField';

import Environments from './environments';
import {TAB} from '../utils';
import withLocalStorage, {InjectedLocalStorageProps} from '../withLocalStorage';
import {getTeamDescription, setTeamDescription} from './utils';

type Props = {
  api: Client;
  location: Location;
  team: Team;
  organization: Organization;
} & ReactRouter.WithRouterProps &
  InjectedLocalStorageProps;

type State = {
  teamDescription: string | undefined;
};

class Settings extends React.Component<Props, State> {
  constructor(props: Props, context) {
    super(props, context);

    this.model = new TeamModel();
    this.model.teamId = props.team.slug;
    this.model.orgId = props.organization.slug;

    const {team, data} = props;

    const teamDescription = getTeamDescription(team.slug, data);

    this.state = {
      teamDescription,
    };
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
    }
  };

  handleChangeTeamDescription = value => {
    this.setState({
      teamDescription: value,
    });
  };

  saveTeamDescription = () => {
    const {team, data, setLs} = this.props;
    setTeamDescription(setLs, team.slug, data, this.state.teamDescription);
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
    const {organization, location, team, data} = this.props;
    const access = new Set(organization.access);

    const teamDescriptionOriginalValue = getTeamDescription(team.slug, data);
    const teamDescriptionHasChanged =
      teamDescriptionOriginalValue !== this.state.teamDescription;

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
          <PanelHeader>{t('Team Description')}</PanelHeader>
          <TextField
            name="team-description"
            label="Set team description"
            placeholder="Set team description"
            onChange={this.handleChangeTeamDescription}
            value={this.state.teamDescription}
          />
          <Field help=" ">
            <div>
              <Button
                priority="primary"
                disabled={!(access.has('team:admin') && teamDescriptionHasChanged)}
                onClick={this.saveTeamDescription}
              >
                {t('Save Changes')}
              </Button>
            </div>
          </Field>
        </Panel>

        <Environments teamSlug={team.slug} />

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

export default ReactRouter.withRouter(withApi(withLocalStorage(Settings, TAB.DASHBOARD)));
