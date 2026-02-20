import {z} from 'zod';

import {t} from 'sentry/locale';

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
 * Combined schema for the setup and edit forms. Provider-specific fields are always
 * strings (initialized to '' when unused). Per-provider required-field validation is
 * enforced via superRefine in the consuming component.
 */
export const dataForwarderFormSchema = z.object({
  is_enabled: z.boolean(),
  enroll_new_projects: z.boolean(),
  project_ids: z.array(z.string()),
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
