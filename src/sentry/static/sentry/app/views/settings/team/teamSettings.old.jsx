import PropTypes from 'prop-types';
import React from 'react';

import AsyncView from '../../asyncView';
import {ApiForm, TextField} from '../../../components/forms';
import {t} from '../../../locale';

export default class TeamSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    team: PropTypes.object.isRequired,
    onTeamChange: PropTypes.func.isRequired,
  };

  getTitle() {
    return 'Team Settings';
  }

  renderBody() {
    let {orgId, teamId} = this.props.params;
    let team = this.props.team;

    return (
      <div className="box">
        <div className="box-content with-padding">
          <ApiForm
            apiMethod="PUT"
            apiEndpoint={`/teams/${orgId}/${teamId}/`}
            initialData={{
              name: team.name,
              slug: team.slug,
            }}
            onSubmitSuccess={this.props.onTeamChange}
            requireChanges={true}
          >
            <TextField
              name="name"
              label={t('Name')}
              placeholder={t('e.g. API Team')}
              required={true}
            />
            <TextField
              name="slug"
              label={t('Short name')}
              placeholder={t('e.g. api-team')}
              required={true}
            />
          </ApiForm>
        </div>
      </div>
    );
  }
}
