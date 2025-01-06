import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ApiForm from 'sentry/components/forms/apiForm';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import FormField from 'sentry/components/forms/formField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {API_ACCESS_SCOPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import recreateRoute from 'sentry/utils/recreateRoute';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import type {DeprecatedApiKey} from './types';

type RouteParams = {
  apiKey: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = DeprecatedAsyncComponent['state'] & {
  apiKey: DeprecatedApiKey;
};

class OrganizationApiKeyDetails extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'apiKey',
        `/organizations/${organization.slug}/api-keys/${this.props.params.apiKey}/`,
      ],
    ];
  }

  handleSubmitSuccess = () => {
    addSuccessMessage('Saved changes');

    // Go back to API list
    this.props.router.push(
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
    const {organization, router} = this.props;
    return (
      <div>
        <SentryDocumentTitle title={t('Edit API Key')} orgSlug={organization.slug} />
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
              router.push(
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
