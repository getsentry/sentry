import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {TRACE_FORMAT_PREFERENCE_KEY} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';

export function useIsEAPTraceEnabled() {
  const organization = useOrganization();

  const isEAPTraceEnabled = organization.features.includes('trace-spans-format');
  const isTraceViewAdminUIEnabled = organization.features.includes('trace-view-admin-ui');
  const [storedTraceFormat] = useSyncedLocalStorageState(
    TRACE_FORMAT_PREFERENCE_KEY,
    'non-eap'
  );

  return isTraceViewAdminUIEnabled
    ? storedTraceFormat === 'eap' && isEAPTraceEnabled
    : isEAPTraceEnabled;
}
