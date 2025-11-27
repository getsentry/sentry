import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface ConfigFormProps {
  organization: Organization;
  project: Project;
}

export function ConfigForm({organization, project}: ConfigFormProps) {
  return (
    <Form
      apiMethod="PUT"
      apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
      initialData={{
        tempestFetchScreenshots: project.tempestFetchScreenshots,
      }}
      saveOnBlur
      hideFooter
    >
      <JsonForm
        forms={[
          {
            title: t('General Settings'),
            fields: [
              {
                name: 'tempestFetchScreenshots',
                type: 'boolean',
                label: t('Attach Screenshots'),
                help: t('Attach screenshots to issues.'),
              },
            ],
          },
        ]}
      />
    </Form>
  );
}
