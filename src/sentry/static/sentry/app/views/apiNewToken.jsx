import React from 'react';
import {browserHistory} from 'react-router';

import AsyncView from './asyncView';
import NarrowLayout from '../components/narrowLayout';
import {ApiForm, MultipleCheckboxField} from '../components/forms';
import {t, tct} from '../locale';

const SCOPES = new Set([
  'project:read',
  'project:write',
  'project:admin',
  'project:releases',
  'team:read',
  'team:write',
  'team:admin',
  'event:read',
  'event:admin',
  'org:read',
  'org:write',
  'org:admin',
  'member:read',
  'member:admin'
]);

const DEFAULT_SCOPES = new Set([
  'event:read',
  'event:admin',
  'project:read',
  'project:releases',
  'org:read',
  'team:read',
  'member:read'
]);

export default class ApiNewToken extends AsyncView {
  getTitle() {
    return 'Create API Token';
  }

  onCancel() {
    browserHistory.pushState(null, '/api/');
  }

  onSubmitSuccess() {
    browserHistory.pushState(null, '/api/');
  }

  renderBody() {
    let defaultScopes = Array.from(DEFAULT_SCOPES);
    defaultScopes.sort();

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
              link: <a href="https://docs.sentry.io/hosted/api/" />
            }
          )}
        </p>
        <ApiForm
          apiMethod="POST"
          apiEndpoint="/api-tokens/"
          className="form-stacked api-new-token"
          initialData={{scopes: defaultScopes}}
          onSubmitSuccess={this.onSubmitSuccess}
          onCancel={this.onCancel}>
          <MultipleCheckboxField
            name="scopes"
            choices={Array.from(SCOPES.keys()).map(s => [s, s])}
            label={t('Scopes')}
            required={true}
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
}
