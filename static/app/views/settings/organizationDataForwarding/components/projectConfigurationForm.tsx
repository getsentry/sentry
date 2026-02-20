import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useMutateDataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import type {DataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/types';

const schema = z.object({
  enroll_new_projects: z.boolean(),
  project_ids: z.array(z.string()),
});

interface Props {
  dataForwarder: DataForwarder;
  projects: Project[];
  disabled?: boolean;
}

export function ProjectConfigurationForm({dataForwarder, projects, disabled}: Props) {
  const organization = useOrganization();

  const {mutate: updateDataForwarder} = useMutateDataForwarder({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder.id},
    onSuccess: df => {
      trackAnalytics('data_forwarding.edit_project_config_complete', {
        organization,
        provider: dataForwarder.provider,
        are_new_projects_enrolled: df?.enrollNewProjects ?? false,
      });
    },
  });

  const projectOptions = projects.map(project => ({
    value: project.id,
    label: project.slug,
    leadingItems: <IdBadge project={project} avatarSize={16} disableLink hideName />,
  }));

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      enroll_new_projects: dataForwarder.enrollNewProjects,
      project_ids: dataForwarder.enrolledProjects.map(p => p.id),
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      updateDataForwarder({
        ...dataForwarder,
        enroll_new_projects: value.enroll_new_projects,
        project_ids: value.project_ids,
      } as unknown as DataForwarder);
    },
  });

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.FieldGroup title={t('Project Configuration')}>
          <form.AppField name="enroll_new_projects">
            {field => (
              <field.Layout.Row
                label={t('Auto-enroll new projects')}
                hintText={t('Should new projects automatically forward their data?')}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="project_ids">
            {field => (
              <field.Layout.Row
                label={t('Forwarding projects')}
                hintText={t('Select the projects which should forward their data.')}
              >
                <field.Select
                  multiple
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={projectOptions}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <Flex justify="end">
            <form.SubmitButton disabled={disabled} priority="primary" size="sm">
              {t('Save Project Configuration')}
            </form.SubmitButton>
          </Flex>
        </form.FieldGroup>
      </form.FormWrapper>
    </form.AppForm>
  );
}
