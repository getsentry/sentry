import {z} from 'zod';

import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';

import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';

const schema = z.object({
  tempestFetchScreenshots: z.boolean(),
});

interface ConfigFormProps {
  organization: Organization;
  project: Project;
}

export function ConfigForm({organization, project}: ConfigFormProps) {
  return (
    <FieldGroup title={t('General Settings')}>
      <AutoSaveField
        name="tempestFetchScreenshots"
        schema={schema}
        initialValue={project.tempestFetchScreenshots ?? false}
        mutationOptions={{
          mutationFn: data =>
            fetchMutation<Project>({
              url: `/projects/${organization.slug}/${project.slug}/`,
              method: 'PUT',
              data,
            }),
          onSuccess: response => ProjectsStore.onUpdateSuccess(response),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Attach Screenshots')}
            hintText={t('Attach screenshots to issues.')}
          >
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    </FieldGroup>
  );
}
