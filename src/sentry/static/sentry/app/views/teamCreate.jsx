import React from 'react';

import AsyncView from './asyncView';
import NarrowLayout from '../components/narrowLayout';
import {ApiForm, TextField} from '../components/forms';
import SentryTypes from '../proptypes';
import {t} from '../locale';

export default class TeamCreate extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  onSubmitSuccess = data => {
    let features = new Set(this.context.organization.features);

    let {orgId} = this.props.params;

    // Legacy behavior: redirect to project creation
    let redirectUrl = `/organizations/${orgId}/projects/new/?team=${data.slug}`;
    if (features.has('new-teams')) {
      // New behavior: redirect to team settings page
      redirectUrl = `/settings/${orgId}/teams/${data.slug}/`;
    }
    window.location.assign(redirectUrl);
  };

  getTitle() {
    return 'Create Team';
  }

  renderField() {
    let features = new Set(this.context.organization.features);
    return features.has('new-teams') ? (
      <TextField
        name="slug"
        label={t('Team Slug')}
        placeholder={t('e.g. operations, web-frontend, desktop')}
        help={t('May contain letters, numbers, dashes and underscores.')}
        required={true}
      />
    ) : (
      <TextField
        name="name"
        label={t('Team Name')}
        placeholder={t('e.g. Operations, Web, Desktop')}
        required={true}
      />
    );
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
          requireChanges={true}
        >
          {this.renderField()}
        </ApiForm>
      </NarrowLayout>
    );
  }
}
