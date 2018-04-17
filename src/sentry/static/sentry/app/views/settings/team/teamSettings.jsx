import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelHeader} from '../../../components/panels';
import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import {removeTeam} from '../../../actionCreators/teams';
import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import Confirm from '../../../components/confirm';
import Field from '../components/forms/field';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import SentryTypes from '../../../proptypes';
import TeamModel from './model';
import teamSettingsFields from '../../../data/forms/teamSettingsFields';
import {Box} from '../../../components/grid';

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

  handleSubmitSuccess = (resp, model, id, change) => {
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));
      this.props.router.push(
        `/settings/${this.props.params.orgId}/teams/${model.getValue(id)}/settings/`
      );
      this.setState({loading: true});
    }
  };

  handleRemoveTeam = () => {
    removeTeam(this.api, this.props.params).then(data => {
      this.props.router.push(`/settings/${this.props.params.orgId}/teams/`);
    });
  };

  renderBody() {
    let {location, organization} = this.context;
    let {team} = this.props;

    let access = new Set(organization.access);

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
          <Box>
            <JsonForm location={location} forms={teamSettingsFields} />
          </Box>
        </Form>

        {access.has('team:admin') && (
          <Panel>
            <PanelHeader>{t('Remove Team')}</PanelHeader>
            <Field
              help={t(
                "This may affect team members' access to projects and associated alert delivery."
              )}
            >
              <div>
                <Confirm
                  onConfirm={this.handleRemoveTeam}
                  priority="danger"
                  message={tct('Are you sure you want to remove the team [team]?', {
                    team: `#${team.slug}`,
                  })}
                >
                  <Button icon="icon-trash" priority="danger" title={t('Remove Team')}>
                    {t('Remove Team')}
                  </Button>
                </Confirm>
              </div>
            </Field>
          </Panel>
        )}
      </React.Fragment>
    );
  }
}
