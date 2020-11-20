import React from 'react';
import {browserHistory} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {API_ACCESS_SCOPES} from 'app/constants';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import ApiForm from 'app/views/settings/components/forms/apiForm';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';
import FormField from 'app/views/settings/components/forms/formField';
import TextareaField from 'app/views/settings/components/forms/textareaField';
import TextField from 'app/views/settings/components/forms/textField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import {DeprecatedApiKey} from './types';

const API_CHOICES = API_ACCESS_SCOPES.map(s => [s, s]);

type RouteParams = {
  orgId: string;
  apiKey: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = AsyncView['state'] & {
  apiKey: DeprecatedApiKey;
};

class OrganizationApiKeyDetails extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [
      [
        'apiKey',
        `/organizations/${this.props.params.orgId}/api-keys/${this.props.params.apiKey}/`,
      ],
    ];
  }

  getTitle() {
    return routeTitleGen(t('Edit API Key'), this.props.organization.slug, false);
  }

  handleSubmitSuccess = () => {
    addSuccessMessage('Saved changes');

    // Go back to API list
    browserHistory.push(
      recreateRoute('', {
        stepBack: -1,
        routes: this.props.routes,
        params: this.props.params,
      })
    );
  };

  handleSubmitError = () => {
    addErrorMessage('Unable to save changes. Please try again.');
  };

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Edit Api Key')} />

        <Panel>
          <PanelHeader>{t('API Key')}</PanelHeader>
          <ApiForm
            apiMethod="PUT"
            apiEndpoint={`/organizations/${this.props.params.orgId}/api-keys/${this.props.params.apiKey}/`}
            initialData={this.state.apiKey}
            onSubmitSuccess={this.handleSubmitSuccess}
            onSubmitError={this.handleSubmitError}
            onCancel={() =>
              browserHistory.push(
                recreateRoute('', {
                  stepBack: -1,
                  routes: this.props.routes,
                  params: this.props.params,
                })
              )
            }
          >
            <PanelBody>
              <TextField label={t('Label')} name="label" />
              <TextField label={t('API Key')} name="key" disabled />

              <FormField name="scope_list" label={t('Scopes')} inline={false} required>
                {({value, onChange}) => (
                  <MultipleCheckbox
                    value={value}
                    onChange={onChange}
                    choices={API_CHOICES}
                  />
                )}
              </FormField>

              <TextareaField
                label={t('Allowed Domains')}
                name="allowed_origins"
                placeholder="e.g. example.com or https://example.com"
                help="Separate multiple entries with a newline"
              />
            </PanelBody>
          </ApiForm>
        </Panel>
      </div>
    );
  }
}

export default withOrganization(OrganizationApiKeyDetails);
