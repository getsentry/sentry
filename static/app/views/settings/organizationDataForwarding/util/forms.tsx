import {z} from 'zod';

import {defineAppFieldGroup, FieldGroup} from '@sentry/scraps/form';
import type {SelectValue} from '@sentry/scraps/select';

import {IdBadge} from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
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
 * edit forms via the TanStack field-group composition pattern.
 *
 * In setup mode (isSetup=true) the switch is locked because forwarding activates after
 * initial configuration is complete.
 */
const enablementFieldGroup = defineAppFieldGroup(({strict}) => ({
  is_enabled: strict<boolean>(),
}));

function EnablementFieldsImpl({
  fields,
  disabled,
  isSetup,
}: {
  disabled: boolean;
  fields: typeof enablementFieldGroup.fields;
  isSetup: boolean;
}) {
  return (
    <FieldGroup title={t('Enablement')}>
      <fields.Field name="is_enabled">
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
              checked={field.value}
              onChange={field.handleChange}
              disabled={isSetup || disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
    </FieldGroup>
  );
}

export const EnablementFields = enablementFieldGroup.bindComponent(
  EnablementFieldsImpl,
  'fields'
);

/**
 * Reusable field group for project enrollment configuration. Shared across all provider
 * setup and edit forms via the TanStack field-group composition pattern.
 */
const projectConfigFieldGroup = defineAppFieldGroup(({strict}) => ({
  enroll_new_projects: strict<boolean>(),
  project_ids: strict<string[]>(),
}));

function ProjectConfigFieldsImpl({
  fields,
  disabled,
  projectOptions,
}: {
  disabled: boolean;
  fields: typeof projectConfigFieldGroup.fields;
  projectOptions: Array<SelectValue<string>>;
}) {
  return (
    <FieldGroup title={t('Project Configuration')}>
      <fields.Field name="enroll_new_projects">
        {field => (
          <field.Layout.Row
            label={t('Auto-enroll new projects')}
            hintText={t('Should new projects automatically forward their data?')}
          >
            <field.Switch
              checked={field.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
      <fields.Field name="project_ids">
        {field => (
          <field.Layout.Row
            label={t('Forwarding projects')}
            hintText={t('Select the projects which should forward their data.')}
          >
            <field.Select
              multiple
              value={field.value}
              onChange={field.handleChange}
              options={projectOptions}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
    </FieldGroup>
  );
}

export const ProjectConfigFields = projectConfigFieldGroup.bindComponent(
  ProjectConfigFieldsImpl,
  'fields'
);
