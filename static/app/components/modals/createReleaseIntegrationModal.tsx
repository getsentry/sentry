import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

export type CreateReleaseIntegrationModalOptions = {
  onCancel: () => void;
  onCreateSuccess: (integration: any) => void;
  organization: Organization;
  project: Project;
};
type CreateReleaseIntegrationModalProps = CreateReleaseIntegrationModalOptions &
  ModalRenderProps;

const schema = z.object({
  name: z.string().min(1, t('Field is required')),
});

type FormValues = z.infer<typeof schema>;

function CreateReleaseIntegrationModal({
  Body,
  Header,
  Footer,
  closeModal,
  project,
  organization,
  onCreateSuccess,
  onCancel,
}: CreateReleaseIntegrationModalProps) {
  const defaultName = `${project.slug} Release Integration`;

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      fetchMutation({
        url: '/sentry-apps/',
        method: 'POST',
        data: {
          ...data,
          organization: organization.slug,
          isAlertable: false,
          isInternal: true,
          scopes: [
            'project:read',
            'project:write',
            'team:read',
            'team:write',
            'project:releases',
            'event:read',
            'event:write',
            'org:read',
            'org:write',
            'member:read',
            'member:write',
          ],
          verifyInstall: false,
          overview: `This internal integration was auto-generated to setup Releases for the ${project.slug} project. It is needed to provide the token used to create a release. If this integration is deleted, your Releases workflow will stop working!`,
        },
      }),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {name: defaultName},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) =>
      mutation
        .mutateAsync(value)
        .then(integration => {
          onCreateSuccess(integration);
          addSuccessMessage(t('Created Release Integration'));
          closeModal();
        })
        .catch(error => {
          const handled =
            error instanceof RequestError ? setFieldErrors(formApi, error) : false;
          if (!handled) {
            addErrorMessage(t('Something went wrong!'));
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <Header>
        <h3>{t('Create a Release Integration')}</h3>
      </Header>
      <Body>
        <form.AppField name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('Name of new integration.')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={defaultName}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button
            onClick={() => {
              onCancel();
              closeModal();
            }}
          >
            {t('Cancel')}
          </Button>
          <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export default CreateReleaseIntegrationModal;
