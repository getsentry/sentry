export enum DataForwarderProviderSlug {
  SEGMENT = 'segment',
  SQS = 'sqs',
  SPLUNK = 'splunk',
}

export const ProviderLabels: Record<DataForwarderProviderSlug, string> = {
  [DataForwarderProviderSlug.SEGMENT]: 'Segment',
  [DataForwarderProviderSlug.SQS]: 'Amazon SQS',
  [DataForwarderProviderSlug.SPLUNK]: 'Splunk',
};
