import {Fragment} from 'react';

import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Payload = {
  clientId: string;
  clientSecret: string;
};

type Props = {
  organization: Organization;
  project: Project;
  formProps?: Partial<typeof Form>;
  onSuccess?: (data: Payload) => void;
};

export default function AddTempestCredentialsForm({
  organization,
  project,
  formProps,
  ...props
}: Props) {
  return (
    <Fragment>
      <Form
        submitLabel={t('Add Credentials')}
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/tempest-credentials/`}
        apiMethod="POST"
        onSubmitSuccess={data => props.onSuccess?.(data)}
        requireChanges
        data-test-id="add-tempest-credentials-form"
        {...formProps}
      >
        <TextField name="clientId" label={t('Client ID')} required />
        <TextField name="clientSecret" label={t('Client Secret')} required />
      </Form>
    </Fragment>
  );
}
