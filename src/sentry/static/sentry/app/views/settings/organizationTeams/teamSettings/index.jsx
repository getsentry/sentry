import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {removeTeam, updateTeamSuccess} from 'app/actionCreators/teams';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import Confirm from 'app/components/confirm';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SentryTypes from 'app/sentryTypes';
import teamSettingsFields from 'app/data/forms/teamSettingsFields';

import TeamModel from './model';

export default class TeamSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    team: PropTypes.object.isRequired,
    onTeamChange: PropTypes.func.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  constructor(props, context) {
    super(props, context);

    this.model = new TeamModel();
    this.model.teamId = props.params.teamId;
    this.model.orgId = props.params.orgId;
  }

  getTitle() {
    return 'Team Settings';
  }

  getEndpoints() {
    return [];
  }

  handleSubmitSuccess = (resp, model, id) => {
    updateTeamSuccess(resp.slug, resp);
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));
      this.props.router.replace(
        `/settings/${this.props.params.orgId}/teams/${model.getValue(id)}/settings/`
      );
      this.setState({loading: true});
    }
  };

  handleRemoveTeam = async () => {
    await removeTeam(this.api, this.props.params);
    this.props.router.replace(`/settings/${this.props.params.orgId}/teams/`);
  };

  renderBody() {
    const {location, organization} = this.context;
    const {team} = this.props;

    const access = new Set(organization.access);

    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }
}
