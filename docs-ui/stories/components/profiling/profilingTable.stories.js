import {OrganizationContext} from 'sentry/views/organizationContext';
import {ProfilingTable} from 'sentry/views/profiling/landing/profilingTable';

export default {
  title: 'Components/Profiling/ProfilingTable',
};

const organization = {
  id: '1',
  slug: 'org-slug',
  access: ['project:releases'],
};

const traces = [
  {
    app_version: '1',
    device_class: 'unclassified',
    device_locale: 'en-US',
    device_manufacturer: 'Google',
    device_model: 'Android SDK built for arm64',
    device_os_name: 'android',
    device_os_version: '10',
    interaction_name: 'app-startup',
    start_time_unix: 1645781000,
    trace_duration_ms: 5600,
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    app_version_name: '1.0.2209',
    android_api_level: '29',
    app_id: '1',
  },
  {
    app_version: '1',
    device_class: 'unclassified',
    device_locale: 'en-US',
    device_manufacturer: 'Google',
    device_model: 'Android SDK built for arm64',
    device_os_name: 'android',
    device_os_version: '10',
    failed: true,
    interaction_name: 'app-startup',
    start_time_unix: 1643750000,
    trace_duration_ms: 123,
    id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    app_version_name: '1.0.2209',
    android_api_level: '29',
    app_id: '1',
  },
];

export const _ProfilingTable = ({loading, error}) => {
  return (
    <OrganizationContext.Provider value={organization}>
      <ProfilingTable
        isLoading={loading}
        error={error ? 'error' : null}
        location={{}}
        traces={traces}
      />
    </OrganizationContext.Provider>
  );
};

_ProfilingTable.args = {
  loading: false,
  error: false,
};
