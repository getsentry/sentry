import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ApiForm from 'sentry/components/forms/apiForm';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import FormField from 'sentry/components/forms/formField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {API_ACCESS_SCOPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {DeprecatedApiKey} from './types';

type RouteParams = {
  apiKey: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = DeprecatedAsyncView['state'] & {
  apiKey: DeprecatedApiKey;
};

class OrganizationApiKeyDetails extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'apiKey',
        `/organizations/${organization.slug}/api-keys/${this.props.params.apiKey}/`,
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
    const {organization} = this.props;
    return (
      <div>
        <SettingsPageHeader title={t('Edit API Key')} />

        <Panel>
          <PanelHeader>{t('API Key')}</PanelHeader>
          <ApiForm
            apiMethod="PUT"
            apiEndpoint={`/organizations/${organization.slug}/api-keys/${this.props.params.apiKey}/`}
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
                {({name, value, onChange}) => (
                  <MultipleCheckbox value={value} onChange={onChange} name={name}>
                    {API_ACCESS_SCOPES.map(scope => (
                      <MultipleCheckbox.Item value={scope} key={scope}>
                        {scope}
                      </MultipleCheckbox.Item>
                    ))}
                  </MultipleCheckbox>
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
