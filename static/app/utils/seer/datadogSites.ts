// Keep in sync with DATADOG_VALID_SITES in src/sentry/integrations/datadog/client.py.
// appHost is the web app hostname: primary sites live at app.<site>, while regional
// sites already carry their region as a subdomain. See
// https://docs.datadoghq.com/getting_started/site/.
export const DATADOG_SITES = [
  {value: 'datadoghq.com', label: 'datadoghq.com (US1)', appHost: 'app.datadoghq.com'},
  {
    value: 'us3.datadoghq.com',
    label: 'us3.datadoghq.com (US3)',
    appHost: 'us3.datadoghq.com',
  },
  {
    value: 'us5.datadoghq.com',
    label: 'us5.datadoghq.com (US5)',
    appHost: 'us5.datadoghq.com',
  },
  {value: 'datadoghq.eu', label: 'datadoghq.eu (EU)', appHost: 'app.datadoghq.eu'},
  {
    value: 'ap1.datadoghq.com',
    label: 'ap1.datadoghq.com (AP1)',
    appHost: 'ap1.datadoghq.com',
  },
  {
    value: 'ap2.datadoghq.com',
    label: 'ap2.datadoghq.com (AP2)',
    appHost: 'ap2.datadoghq.com',
  },
  {value: 'ddog-gov.com', label: 'ddog-gov.com (US1-FED)', appHost: 'app.ddog-gov.com'},
  {
    value: 'us2.ddog-gov.com',
    label: 'us2.ddog-gov.com (US2-FED)',
    appHost: 'us2.ddog-gov.com',
  },
];

export const DATADOG_SITE_VALUES = DATADOG_SITES.map(site => site.value) as [
  string,
  ...string[],
];
