import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';

interface Props extends ModalRenderProps {
  organization: Organization;
  origin: 'onboarding' | 'project-creation' | 'project-settings';
  project: Project;
}

const schema = z.object({
  clientId: z.string().min(1, t('Client ID is required')),
  clientSecret: z.string().min(1, t('Client Secret is required')),
});

type FormValues = z.infer<typeof schema>;

export default function AddCredentialsModal({
  closeModal,
  organization,
  origin,
  project,
  Header,
  Body,
  Footer,
}: Props) {
  const {invalidateCredentialsCache} = useFetchTempestCredentials(organization, project);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      fetchMutation({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/tempest-credentials/',
          {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}}
        ),
        method: 'POST',
        data,
      }),
  });

  const form = useScrapsForm({
    defaultValues: {clientId: '', clientSecret: ''},
    validators: defaultFormValidators(schema),
    onSubmit: ({value, createValidationError}) =>
      mutation
        .mutateAsync(value)
        .then(() => {
          addSuccessMessage(t('Credentials submitted successfully'));
          invalidateCredentialsCache();
          trackAnalytics('tempest.credentials.added', {
            organization,
            project_slug: project.slug,
            origin,
          });
          closeModal();
        })
        .catch(error => {
          if (error instanceof RequestError) {
            const fields = requestErrorToFieldErrors(error, value);
            if (fields) {
              return createValidationError({fields});
            }
          }
          addErrorMessage(t('Unable to add credentials'));
          return;
        }),
  });

  return (
    <ScrapsForm form={form}>
      <Header closeButton>{t('Add New Credentials')}</Header>
      <Body>
        <Stack gap="xl">
          <form.Field name="clientId">
            {field => (
              <field.Layout.Stack label={t('Client ID')} required>
                <field.Input value={field.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="clientSecret">
            {field => (
              <field.Layout.Stack label={t('Client Secret')} required>
                <field.Input value={field.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.Field>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>{t('Add Credentials')}</form.SubmitButton>
      </Footer>
    </ScrapsForm>
  );
}
