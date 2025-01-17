import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import type {Field} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';

export type CreateReleaseIntegrationModalOptions = {
  onCancel: () => void;
  onCreateSuccess: (integration: any) => void;
  organization: Organization;
  project: Project;
};
type CreateReleaseIntegrationModalProps = CreateReleaseIntegrationModalOptions &
  ModalRenderProps;

function CreateReleaseIntegrationModal({
  Body,
  Header,
  closeModal,
  project,
  organization,
  onCreateSuccess,
  onCancel,
}: CreateReleaseIntegrationModalProps) {
  const api = useApi();
  const fields: Field[] = [
    {
      name: 'name',
      type: 'string',

      placeholder: `${project.slug} Release Integration`,
      label: t('Name'),
      help: <Fragment>{t('Name of new integration.')}</Fragment>,
      defaultValue: `${project.slug} Release Integration`,
      required: true,
    },
  ];
  return (
    <Fragment>
      <Header>
        <h3>{t('Create a Release Integration')}</h3>
      </Header>
      <Body>
        <Form
          onCancel={() => {
            onCancel();
            closeModal();
          }}
          onSubmit={async (data, onSubmitSuccess, onSubmitError) => {
            try {
              const integration = await api.requestPromise('/sentry-apps/', {
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
              });
              onSubmitSuccess(integration);
            } catch (error) {
              onSubmitError(error);
            }
          }}
          onSubmitSuccess={data => {
            onCreateSuccess(data);
            addSuccessMessage(t('Created Release Integration'));
            closeModal();
          }}
          onSubmitError={() => {
            addErrorMessage(t('Something went wrong!'));
          }}
        >
          {fields.map(field => (
            <FieldFromConfig key={field.name} field={field} />
          ))}
        </Form>
      </Body>
    </Fragment>
  );
}

export default CreateReleaseIntegrationModal;
