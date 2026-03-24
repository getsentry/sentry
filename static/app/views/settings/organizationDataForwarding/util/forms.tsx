import {z} from 'zod';

import {withFieldGroup} from '@sentry/scraps/form';

import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import type {DataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function getCreateTooltip(params: {
  hasAccess: boolean;
  hasAvailability: boolean;
  hasFeature: boolean;
}): string | undefined {
  if (!params.hasFeature) {
    return t('This feature is not available for your organization');
  }
  if (!params.hasAccess) {
    return t(
      'You must be an organization owner, manager or admin to configure data forwarding.'
    );
  }
  if (!params.hasAvailability) {
    return t('Maximum data forwarders configured.');
  }
  return undefined;
}

/**
 * Base schema fields shared across all provider forms.
 */
export const baseDataForwarderSchema = z.object({
  is_enabled: z.boolean(),
  enroll_new_projects: z.boolean(),
  project_ids: z.array(z.string()),
});

/**
 * Default values for the base fields when creating a new forwarder.
 */
export const baseFormSetupDefaults = {
  is_enabled: false,
  enroll_new_projects: false,
  project_ids: [] as string[],
};

/**
 * Builds base field defaults from an existing DataForwarder for edit forms.
 */
export function baseFormEditDefaults(dataForwarder: DataForwarder) {
  return {
    is_enabled: dataForwarder.isEnabled,
    enroll_new_projects: dataForwarder.enrollNewProjects,
    project_ids: dataForwarder.enrolledProjects.map(p => String(p.id)),
  };
}

/**
 * Builds the project options list for the project selector field.
 */
export function buildProjectOptions(projects: Project[]): Array<SelectValue<string>> {
  return projects.map(project => ({
    value: project.id,
    label: project.slug,
    leadingItems: <IdBadge project={project} avatarSize={16} disableLink hideName />,
  }));
}

/**
 * Schema for per-project override forms. All provider-specific fields are strings
 * (initialized to '' when unused; an empty override means "use global value").
 */
export const dataForwarderOverrideSchema = z.object({
  is_enabled: z.boolean(),
  // SQS
  queue_url: z.string(),
  region: z.string(),
  access_key: z.string(),
  secret_key: z.string(),
  message_group_id: z.string(),
  s3_bucket: z.string(),
  // Segment
  write_key: z.string(),
  // Splunk
  instance_url: z.string(),
  token: z.string(),
  index: z.string(),
  source: z.string(),
});

/**
 * Reusable field group for the enablement toggle. Shared across all provider setup and
 * edit forms via the TanStack withFieldGroup composition pattern.
 *
 * In setup mode (isSetup=true) the switch is locked because forwarding activates after
 * initial configuration is complete.
 */
export const EnablementFields = withFieldGroup({
  defaultValues: {is_enabled: false},
  props: {disabled: false, isSetup: false},
  render: ({group, disabled, isSetup}) => (
    <group.FieldGroup title={t('Enablement')}>
      <group.AppField name="is_enabled">
        {field => (
          <field.Layout.Row
            label={t('Enable data forwarding')}
            hintText={
              isSetup
                ? t('Will be enabled after the initial setup is complete.')
                : t('Will override all projects to shut-off data forwarding altogether.')
            }
          >
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={isSetup || disabled}
            />
          </field.Layout.Row>
        )}
      </group.AppField>
    </group.FieldGroup>
  ),
});

/**
 * Reusable field group for project enrollment configuration. Shared across all provider
 * setup and edit forms via the TanStack withFieldGroup composition pattern.
 */
export const ProjectConfigFields = withFieldGroup({
  defaultValues: {enroll_new_projects: false, project_ids: [] as string[]},
  props: {disabled: false, projectOptions: [] as Array<SelectValue<string>>},
  render: ({group, disabled, projectOptions}) => (
    <group.FieldGroup title={t('Project Configuration')}>
      <group.AppField name="enroll_new_projects">
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
      </group.AppField>
      <group.AppField name="project_ids">
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
      </group.AppField>
    </group.FieldGroup>
  ),
});
