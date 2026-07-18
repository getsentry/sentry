// Keep in sync with DATADOG_VALID_SITES in src/sentry/identity/datadog/provider.py.
export const DATADOG_SITES = [
  {value: 'datadoghq.com', label: 'datadoghq.com (US1)'},
  {value: 'us3.datadoghq.com', label: 'us3.datadoghq.com (US3)'},
  {value: 'us5.datadoghq.com', label: 'us5.datadoghq.com (US5)'},
  {value: 'datadoghq.eu', label: 'datadoghq.eu (EU)'},
  {value: 'ap1.datadoghq.com', label: 'ap1.datadoghq.com (AP1)'},
  {value: 'ap2.datadoghq.com', label: 'ap2.datadoghq.com (AP2)'},
  {value: 'ddog-gov.com', label: 'ddog-gov.com (US1-FED)'},
  {value: 'us2.ddog-gov.com', label: 'us2.ddog-gov.com (US2-FED)'},
];

export const DATADOG_SITE_VALUES = DATADOG_SITES.map(site => site.value) as [
  string,
  ...string[],
];
