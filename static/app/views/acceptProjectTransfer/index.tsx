import {addErrorMessage} from 'sentry/actionCreators/indicator';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import type {Data} from 'sentry/components/forms/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type TransferDetails = {
  organizations: Organization[];
  project: Project;
};

function AcceptProjectTransfer() {
  const api = useApi({persistInFlight: true});
  const location = useLocation();

  const regionHost = (): string | undefined => {
    // Because this route happens outside of OrganizationContext we
    // need to use initial data to decide which host to send the request to
    // as `/accept-transfer/` cannot be resolved to a region.
    const initialData = window.__initialData;
    let host: string | undefined = undefined;
    if (initialData && initialData.links?.regionUrl !== initialData.links?.sentryUrl) {
      host = initialData.links.regionUrl;
    }

    return host;
  };

  const {
    data: transferDetails,
    isPending,
    isError,
    error,
  } = useApiQuery<TransferDetails>(
    ['/accept-transfer/', {query: location.query, host: regionHost()}],
    {
      staleTime: 0,
    }
  );

  const handleSubmitMutation = useMutation({
    mutationFn: (formData: Data) => {
      return api.requestPromise('/accept-transfer/', {
        method: 'POST',
        host: regionHost(),
        data: {
          data: location.query.data,
          organization: formData.organization,
        },
      });
    },
    onSuccess: (_, formData) => {
      const orgSlug = formData.organization;
      const projectSlug = transferDetails?.project.slug;
      const sentryUrl = ConfigStore.get('links').sentryUrl;
      if (projectSlug) {
        testableWindowLocation.assign(
          `${sentryUrl}/organizations/${orgSlug}/settings/projects/${projectSlug}/teams/`
        );
        // done this way since we need to change subdomains
      } else {
        testableWindowLocation.assign(`${sentryUrl}/organizations/${orgSlug}/projects/`);
      }
    },
    onError: () => {
      const errorMsg =
        error?.responseJSON && typeof error.responseJSON.detail === 'string'
          ? error.responseJSON.detail
          : '';

      addErrorMessage(
        tct('Unable to transfer project. [errorMsg]', {errorMsg: errorMsg ?? ''})
      );
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    // Check if there is an error message with `transferDetails` endpoint
    // If so, show as toast and ignore, otherwise log to sentry
    if (error?.responseJSON && typeof error.responseJSON.detail === 'string') {
      addErrorMessage(error.responseJSON.detail);
    }
  }

  const options = transferDetails?.organizations.map(org => ({
    label: org.slug,
    value: org.slug,
  }));
  const organization = options?.[0]?.value;

  return (
    <NarrowLayout>
      <SentryDocumentTitle title={t('Accept Project Transfer')} />
      <SettingsPageHeader title={t('Approve Transfer Project Request')} />
      <p>
        {tct(
          'Projects must be transferred to a specific [organization]. You can grant specific teams access to the project later under the [projectSettings]. (Note that granting access to at least one team is necessary for the project to appear in all parts of the UI.)',
          {
            organization: <strong>{t('Organization')}</strong>,
            projectSettings: <strong>{t('Project Settings')}</strong>,
          }
        )}
      </p>
      {transferDetails && (
        <p>
          {tct('Please select which [organization] you want for the project [project].', {
            organization: <strong>{t('Organization')}</strong>,
            project: transferDetails.project.slug,
          })}
        </p>
      )}
      <Form
        onSubmit={data => handleSubmitMutation.mutate(data)}
        submitLabel={t('Transfer Project')}
        submitPriority="danger"
        initialData={organization ? {organization} : undefined}
      >
        <SelectField
          options={options}
          label={t('Organization')}
          name="organization"
          style={{borderBottom: 'none'}}
        />
      </Form>
    </NarrowLayout>
  );
}

export default AcceptProjectTransfer;
