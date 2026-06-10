import {DataForwarderProviderSlug} from 'sentry/views/settings/organizationDataForwarding/util/types';

export const DATA_FORWARDING_FEATURES = ['organizations:data-forwarding'];
export const DATA_FORWARDING_DOCS_URL =
  'https://docs.sentry.io/organization/integrations/data-forwarding/';

export const ProviderLabels: Record<DataForwarderProviderSlug, string> = {
  [DataForwarderProviderSlug.SPLUNK]: 'Splunk',
  [DataForwarderProviderSlug.SEGMENT]: 'Segment',
  [DataForwarderProviderSlug.SQS]: 'Amazon SQS',
};
