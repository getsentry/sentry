import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import NarrowLayout from 'app/components/narrowLayout';
import OrganizationCreateForm from 'app/views/organizationCreate/organizationCreateForm';

export default class OrganizationCreate extends AsyncView {
  handleSubmitSuccess = data => {
    // redirect to project creation *(BYPASS REACT ROUTER AND FORCE PAGE REFRESH TO GRAB CSRF TOKEN)*
    // browserHistory.pushState(null, `/organizations/${data.slug}/projects/new/`);
    window.location.href = `/organizations/${data.slug}/projects/new/`;
  };

  getEndpoints() {
    return [];
  }

  getTitle() {
    return 'Create Organization';
  }

  renderBody() {
    return (
      <NarrowLayout>
        <h3>{t('Create a New Organization')}</h3>

        <p>
          {t(
            "Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users."
          )}
        </p>

        <OrganizationCreateForm onSubmitSuccess={this.handleSubmitSuccess} />
      </NarrowLayout>
    );
  }
}
