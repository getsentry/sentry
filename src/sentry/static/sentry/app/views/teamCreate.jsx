import React from 'react';

import NarrowLayout from '../components/narrowLayout';
import {ApiForm, TextField} from '../components/forms';
import {t} from '../locale';

export default React.createClass({
  onSubmitSuccess(data) {
    let {orgId} = this.props.params;
    // redirect to project creation
    window.location.href = `/organizations/${orgId}/projects/new/?team=${data.slug}`;
  },

  render() {
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
          fields={[
            {
              name: 'name',
              label: 'Team Name',
              placeholder: 'e.g. Operations, Web, Desktop',
              required: true,
              component: TextField
            }
          ]}
          submitLabel={t('Save Changes')}
          apiEndpoint={`/organizations/${orgId}/teams/`}
          apiMethod="POST"
          onSubmitSuccess={this.onSubmitSuccess}
        />
      </NarrowLayout>
    );
  }
});
