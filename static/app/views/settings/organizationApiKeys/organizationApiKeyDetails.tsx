import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ApiForm from 'sentry/components/forms/apiForm';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import FormField from 'sentry/components/forms/formField';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {API_ACCESS_SCOPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import type {DeprecatedApiKey} from './types';

type RouteParams = {
  apiKey: string;
};

function OrganizationApiKeyDetails() {
  const organization = useOrganization();
  const params = useParams<RouteParams>();
  const navigate = useNavigate();
  const {
    data: apiKey,
    isPending,
    isError,
    refetch,
  } = useApiQuery<DeprecatedApiKey>(
    [`/organizations/${organization.slug}/api-keys/${params.apiKey}/`],
    {
      staleTime: 0,
    }
  );

  const handleSubmitSuccess = () => {
    addSuccessMessage('Saved changes');

    // Go back to API list
    navigate(`/settings/${organization.slug}/api-keys/`);
  };

  const handleSubmitError = () => {
    addErrorMessage('Unable to save changes. Please try again.');
  };

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <SentryDocumentTitle title={t('Edit API Key')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Edit API Key')} />

      <Panel>
        <PanelHeader>{t('API Key')}</PanelHeader>
        <ApiForm
          apiMethod="PUT"
          apiEndpoint={`/organizations/${organization.slug}/api-keys/${params.apiKey}/`}
          initialData={apiKey}
          onSubmitSuccess={handleSubmitSuccess}
          onSubmitError={handleSubmitError}
          onCancel={() => navigate(`/settings/${organization.slug}/api-keys/`)}
        >
          <PanelBody>
            <TextField label={t('Label')} name="label" />
            <TextField label={t('API Key')} name="key" disabled />

            <FormField name="scope_list" label={t('Scopes')} inline={false} required>
              {({name, value, onChange}: any) => (
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

export default OrganizationApiKeyDetails;
