import React from 'react';

import AsyncView from './asyncView';
import NarrowLayout from '../components/narrowLayout';
import {ApiForm, TextField} from '../components/forms';
import {t} from '../locale';

export default class TeamCreate extends AsyncView {
  onSubmitSuccess = data => {
    let {orgId} = this.props.params;
    // redirect to project creation
    window.location.href = `/organizations/${orgId}/projects/new/?team=${data.slug}`;
  };

  getTitle() {
    return 'Create Team';
  }

  renderBody() {
    let {orgId} = this.props.params;
    return (
      <NarrowLayout>
        <h3>{t('Create a New Team')}</h3>

        <p>
          {t(
            "Teams group members' access to a specific focus, e.g. a major product or application that may have sub-projects."
          )}
        </p>

        <ApiForm
          submitLabel={t('Save Changes')}
          apiEndpoint={`/organizations/${orgId}/teams/`}
          apiMethod="POST"
          onSubmitSuccess={this.onSubmitSuccess}
          requireChanges={true}>
          <TextField
            name="name"
            label={t('Team Name')}
            placeholder={t('e.g. Operations, Web, Desktop')}
            required={true}
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
}
