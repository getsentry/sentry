import React from 'react';

import NarrowLayout from '../components/narrowLayout';
import {ApiForm, TextField} from '../components/forms';
import {t} from '../locale';

export default React.createClass({
  onSubmitSuccess(data) {
    // redirect to project creation
    // browserHistory.pushState(null, `/organizations/${data.slug}/projects/new/`);
    window.location.href = `/organizations/${data.slug}/projects/new/`;
  },

  render() {
    return (
      <NarrowLayout>
        <h3>{t('Create a New Organization')}</h3>

        <p>
          {t(
            "Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users."
          )}
        </p>

        <ApiForm
          initialData={{defaultTeam: true}}
          submitLabel={t('Create Organization')}
          apiEndpoint="/organizations/"
          apiMethod="POST"
          onSubmitSuccess={this.onSubmitSuccess}>
          <TextField
            name="name"
            label={t('Organization Name')}
            placeholder={t('e.g. My Company')}
            required={true}
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
});
