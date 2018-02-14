import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage, saveOnBlurUndoMessage} from '../../../actionCreators/indicator';
import AsyncView from '../../asyncView';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import teamSettingsFields from '../../../data/forms/teamSettingsFields';
import TeamModel from './model';

const TOAST_DURATION = 10000;

export default class TeamSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    team: PropTypes.object.isRequired,
    onTeamChange: PropTypes.func.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
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

  renderBody() {
    let team = this.props.team;

    return (
      <Form
        model={this.model}
        apiMethod="PUT"
        saveOnBlur
        allowUndo
        onSubmitSuccess={(change, model, id) => {
          saveOnBlurUndoMessage(change, model, id);
        }}
        onSubmitError={() => addErrorMessage('Unable to save change', TOAST_DURATION)}
        initialData={{
          name: team.name,
          slug: team.slug,
        }}
      >
        <Box>
          <JsonForm location={this.context.location} forms={teamSettingsFields} />
        </Box>
      </Form>
    );
  }
}
