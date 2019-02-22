import React from 'react';
import {browserHistory} from 'react-router';

import AsyncView from 'app/views/asyncView';
import {API_SCOPES, DEFAULT_API_SCOPES} from 'app/constants';
import NarrowLayout from 'app/components/narrowLayout';
import {ApiForm, MultipleCheckboxField} from 'app/components/forms';
import {t, tct} from 'app/locale';

const SORTED_DEFAULT_API_SCOPES = DEFAULT_API_SCOPES.sort();
const API_CHOICES = API_SCOPES.map(s => [s, s]);

export default class ApiNewToken extends AsyncView {
  getEndpoints() {
    return [];
  }

  getTitle() {
    return 'Create API Token';
  }

  onCancel() {
    browserHistory.push('/api/');
  }

  onSubmitSuccess() {
    browserHistory.push('/api/');
  }

  renderBody() {
    return (
      <NarrowLayout>
        <h3>{t('Create New Token')}</h3>
        <hr />
        <p>
          {t(
            "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          )}
        </p>
        <p>
          {tct(
            'For more information on how to use the web API, see our [link:documentation].',
            {
              link: <a href="https://docs.sentry.io/hosted/api/" />,
            }
          )}
        </p>
        <ApiForm
          apiMethod="POST"
          apiEndpoint="/api-tokens/"
          className="form-stacked api-new-token"
          initialData={{scopes: SORTED_DEFAULT_API_SCOPES}}
          onSubmitSuccess={this.onSubmitSuccess}
          onCancel={this.onCancel}
        >
          <MultipleCheckboxField
            name="scopes"
            choices={API_CHOICES}
            label={t('Scopes')}
            required={true}
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
}
