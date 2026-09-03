import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProjectMutationOptions} from 'sentry/utils/project/useUpdateProject';

const schema = z.object({
  tempestFetchScreenshots: z.boolean(),
});

interface ConfigFormProps {
  organization: Organization;
  project: DetailedProject;
}

export function ConfigForm({organization, project}: ConfigFormProps) {
  const {data: currentProject = project} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: project.slug},
    {initialData: {headers: {}, json: project}}
  );
  const projectMutationOptions = useUpdateProjectMutationOptions(currentProject);

  return (
    <FieldGroup title={t('General Settings')}>
      <AutoSaveForm
        name="tempestFetchScreenshots"
        schema={schema}
        initialValue={currentProject.tempestFetchScreenshots ?? false}
        mutationOptions={projectMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Attach Screenshots')}
            hintText={t('Attach screenshots to issues.')}
          >
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
