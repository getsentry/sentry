import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {removeTeam, updateTeamSuccess} from 'app/actionCreators/teams';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel, PanelHeader} from 'app/components/panels';
import teamSettingsFields from 'app/data/forms/teamSettingsFields';
import {IconDelete} from 'app/icons';
import {t, tct} from 'app/locale';
import {LightWeightOrganization, Scope, Team} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';

import TeamModel from './model';

type Props = RouteComponentProps<{orgId: string; teamId: string}, {}> & {
  organization: LightWeightOrganization;
  team: Team;
};

type State = AsyncView['state'];

class TeamSettings extends AsyncView<Props, State> {
  model = new TeamModel(this.props.params.orgId, this.props.params.teamId);

  getTitle() {
    return 'Team Settings';
  }

  getEndpoints() {
    return [];
  }

  handleSubmitSuccess = (resp: any, model: FormModel, id?: string) => {
    updateTeamSuccess(resp.slug, resp);
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));
      browserHistory.replace(
        `/settings/${this.props.params.orgId}/teams/${model.getValue(id)}/settings/`
      );
      this.setState({loading: true});
    }
  };

  handleRemoveTeam = async () => {
    await removeTeam(this.api, this.props.params);
    browserHistory.replace(`/settings/${this.props.params.orgId}/teams/`);
  };

  renderBody() {
    const {organization, team} = this.props;

    const access = new Set<Scope>(organization.access);

    return (
      <Fragment>
        <Form
          model={this.model}
          apiMethod="PUT"
          saveOnBlur
          allowUndo
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={() => addErrorMessage(t('Unable to save change'))}
          initialData={{
            name: team.name,
            slug: team.slug,
          }}
        >
          <JsonForm access={access} forms={teamSettingsFields} />
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
      </Fragment>
    );
  }
}
export default withOrganization(TeamSettings);
