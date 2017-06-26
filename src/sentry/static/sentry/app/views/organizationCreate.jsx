import React from 'react';

import NarrowLayout from '../components/narrowLayout';
import {ApiForm, TextField} from '../components/forms';
import {t} from '../locale';

export default React.createClass({
  onSubmitComplete(data) {
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
          fields={[
            {
              name: 'name',
              label: 'Organization Name',
              placeholder: 'e.g. My Company',
              required: true,
              component: TextField
            }
          ]}
          submitLabel={t('Create Organization')}
          apiEndpoint="/organizations/"
          apiMethod="POST"
          onSubmitComplete={this.onSubmitComplete}
        />
      </NarrowLayout>
    );
  }
});
