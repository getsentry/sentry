import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ApiForm from 'sentry/components/forms/apiForm';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import FormField from 'sentry/components/forms/formField';
import TextareaField from 'sentry/components/forms/textareaField';
import TextField from 'sentry/components/forms/textField';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {API_ACCESS_SCOPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Choices, Organization} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {DeprecatedApiKey} from './types';

const API_CHOICES: Choices = API_ACCESS_SCOPES.map(s => [s, s]);

type RouteParams = {
  apiKey: string;
  orgId: string;
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
        <SettingsPageHeader title={t('Edit API Key')} />

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
