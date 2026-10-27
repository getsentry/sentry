import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProjectMutationOptions} from 'sentry/utils/project/useUpdateProject';

const schema = z.object({
  enableNativeSourceServerMapping: z.boolean(),
});

type Props = {
  organization: Organization;
  project: DetailedProject;
};

export function SourceServerMapping({organization, project}: Props) {
  const projectMutationOptions = useUpdateProjectMutationOptions(project);
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  return (
    <FieldGroup title={t('Source Server')}>
      <AutoSaveForm
        name="enableNativeSourceServerMapping"
        schema={schema}
        initialValue={project.enableNativeSourceServerMapping ?? false}
        mutationOptions={projectMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Use Source Server Information')}
            hintText={t(
              'Use the source server (srcsrv) paths and revisions embedded in debug files for native stack frames. Applies to new events.'
            )}
          >
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={
                hasAccess ? false : t('You do not have permission to edit this setting.')
              }
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
