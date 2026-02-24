import {z} from 'zod';

import {t} from 'sentry/locale';
import {DataForwarderProviderSlug} from 'sentry/views/settings/organizationDataForwarding/util/types';

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
const dataForwarderFormSchema = z.object({
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

/**
 * Builds a provider-specific validation schema by extending the base form schema
 * with required-field checks for the given provider.
 */
export function buildDataForwardingProviderSchema(provider: DataForwarderProviderSlug) {
  return dataForwarderFormSchema.superRefine((data, ctx) => {
    if (provider === DataForwarderProviderSlug.SQS) {
      if (!data.queue_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['queue_url'],
          message: t('Queue URL is required'),
        });
      }
      if (!data.region?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['region'],
          message: t('Region is required'),
        });
      }
      if (!data.access_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['access_key'],
          message: t('Access key is required'),
        });
      }
      if (!data.secret_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['secret_key'],
          message: t('Secret key is required'),
        });
      }
    } else if (provider === DataForwarderProviderSlug.SEGMENT) {
      if (!data.write_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['write_key'],
          message: t('Write key is required'),
        });
      }
    } else if (provider === DataForwarderProviderSlug.SPLUNK) {
      if (!data.instance_url?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['instance_url'],
          message: t('Instance URL is required'),
        });
      }
      if (!data.token?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['token'],
          message: t('Token is required'),
        });
      }
      if (!data.index?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['index'],
          message: t('Index is required'),
        });
      }
      if (!data.source?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source'],
          message: t('Source is required'),
        });
      }
    }
  });
}

type ProviderConfigFields = Pick<
  z.infer<typeof dataForwarderFormSchema>,
  | 'queue_url'
  | 'region'
  | 'access_key'
  | 'secret_key'
  | 'message_group_id'
  | 's3_bucket'
  | 'write_key'
  | 'instance_url'
  | 'token'
  | 'index'
  | 'source'
>;

/**
 * Builds the provider-specific config object from form field values.
 */
export function buildDataForwardingProviderConfig(
  provider: DataForwarderProviderSlug,
  fields: ProviderConfigFields
): Record<string, string | undefined> {
  if (provider === DataForwarderProviderSlug.SQS) {
    return {
      queue_url: fields.queue_url,
      region: fields.region,
      access_key: fields.access_key,
      secret_key: fields.secret_key,
      message_group_id: fields.message_group_id || undefined,
      s3_bucket: fields.s3_bucket || undefined,
    };
  }
  if (provider === DataForwarderProviderSlug.SEGMENT) {
    return {write_key: fields.write_key};
  }
  return {
    instance_url: fields.instance_url,
    token: fields.token,
    index: fields.index,
    source: fields.source,
  };
}
