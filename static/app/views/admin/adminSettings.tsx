import Feature from 'sentry/components/acl/feature';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

import {getOption, getOptionField} from './options';

const optionsAvailable = [
  'system.url-prefix',
  'system.admin-email',
  'system.support-email',
  'system.security-email',
  'system.rate-limit',
  'auth.allow-registration',
  'auth.ip-rate-limit',
  'auth.user-rate-limit',
  'api.rate-limit.org-create',
  'beacon.anonymous',
  'performance.issues.all.problem-detection',
  'performance.issues.n_plus_one_db.problem-creation',
  'performance.issues.n_plus_one_db_ext.problem-creation',
  'performance.issues.n_plus_one_db.count_threshold',
  'performance.issues.n_plus_one_db.duration_threshold',
  'performance.issues.consecutive_db.problem-creation',
  'performance.issues.consecutive_db.la-rollout',
  'performance.issues.consecutive_db.ea-rollout',
  'performance.issues.consecutive_db.ga-rollout',
  'performance.issues.n_plus_one_api_calls.problem-creation',
  'performance.issues.n_plus_one_api_calls.la-rollout',
  'performance.issues.n_plus_one_api_calls.ea-rollout',
  'performance.issues.n_plus_one_api_calls.ga-rollout',
  'performance.issues.compressed_assets.problem-creation',
  'performance.issues.compressed_assets.la-rollout',
  'performance.issues.compressed_assets.ea-rollout',
  'performance.issues.compressed_assets.ga-rollout',
  'performance.issues.file_io_main_thread.problem-creation',
  'performance.issues.slow_db_query.problem-creation',
  'performance.issues.slow_db_query.la-rollout',
  'performance.issues.slow_db_query.ea-rollout',
  'performance.issues.slow_db_query.ga-rollout',
  'performance.issues.render_blocking_assets.problem-creation',
  'performance.issues.render_blocking_assets.la-rollout',
  'performance.issues.render_blocking_assets.ea-rollout',
  'performance.issues.render_blocking_assets.ga-rollout',
  'performance.issues.m_n_plus_one_db.problem-creation',
  'performance.issues.m_n_plus_one_db.la-rollout',
  'performance.issues.m_n_plus_one_db.ea-rollout',
  'performance.issues.m_n_plus_one_db.ga-rollout',
  'performance.issues.consecutive_http.max_duration_between_spans',
  'performance.issues.consecutive_http.consecutive_count_threshold',
  'performance.issues.consecutive_http.span_duration_threshold',
  'performance.issues.large_http_payload.size_threshold',
  'profile.issues.blocked_main_thread-ingest.la-rollout',
  'profile.issues.blocked_main_thread-ingest.ea-rollout',
  'profile.issues.blocked_main_thread-ingest.ga-rollout',
  'profile.issues.blocked_main_thread-ppg.la-rollout',
  'profile.issues.blocked_main_thread-ppg.ea-rollout',
  'profile.issues.blocked_main_thread-ppg.ga-rollout',
];

type Field = ReturnType<typeof getOption>;

type FieldDef = {
  field: Field;
  value: string | undefined;
};

export default function AdminSettings() {
  const {data, isPending, isError} = useApiQuery<Record<string, FieldDef>>(
    ['/internal/options/'],
    {
      staleTime: 0,
    }
  );

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const initialData = {};
  const fields = {};
  for (const key of optionsAvailable) {
    const option = data[key] ?? ({field: {}, value: undefined} as FieldDef);

    if (option.value === undefined || option.value === '') {
      const defn = getOption(key);
      initialData[key] = defn.defaultValue ? defn.defaultValue() : '';
    } else {
      initialData[key] = option.value;
    }
    fields[key] = getOptionField(key, option.field);
  }

  return (
    <div>
      <h3>{t('Settings')}</h3>

      <Form
        apiMethod="PUT"
        apiEndpoint={'/internal/options/'}
        initialData={initialData}
        saveOnBlur
      >
        <Panel>
          <PanelHeader>{t('General')}</PanelHeader>
          {fields['system.url-prefix']}
          {fields['system.admin-email']}
          {fields['system.support-email']}
          {fields['system.security-email']}
          {fields['system.rate-limit']}
        </Panel>

        <Panel>
          <PanelHeader>{t('Security & Abuse')}</PanelHeader>
          {fields['auth.allow-registration']}
          {fields['auth.ip-rate-limit']}
          {fields['auth.user-rate-limit']}
          {fields['api.rate-limit.org-create']}
        </Panel>

        <Panel>
          <PanelHeader>{t('Beacon')}</PanelHeader>
          {fields['beacon.anonymous']}
        </Panel>

        <Feature features="organizations:performance-issues-dev">
          <Panel>
            <PanelHeader>{t('Performance Issues - All')}</PanelHeader>
            {fields['performance.issues.all.problem-detection']}
          </Panel>
          <Panel>
            <PanelHeader>{t('Performance Issues - Detectors')}</PanelHeader>
            {fields['performance.issues.n_plus_one_db.problem-creation']}
            {fields['performance.issues.n_plus_one_db_ext.problem-creation']}
            {fields['performance.issues.n_plus_one_db.count_threshold']}
            {fields['performance.issues.n_plus_one_db.duration_threshold']}
          </Panel>
          <Panel>
            <PanelHeader>{t('Performance Issues - Consecutive DB Detector')}</PanelHeader>
            {fields['performance.issues.consecutive_db.problem-creation']}
            {fields['performance.issues.consecutive_db.la-rollout']}
            {fields['performance.issues.consecutive_db.ea-rollout']}
            {fields['performance.issues.consecutive_db.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>{t('Performance Issues - N+1 API Calls Detector')}</PanelHeader>
            {fields['performance.issues.n_plus_one_api_calls.problem-creation']}
            {fields['performance.issues.n_plus_one_api_calls.la-rollout']}
            {fields['performance.issues.n_plus_one_api_calls.ea-rollout']}
            {fields['performance.issues.n_plus_one_api_calls.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>
              {t('Performance Issues - Compressed Assets Detector')}
            </PanelHeader>
            {fields['performance.issues.compressed_assets.problem-creation']}
            {fields['performance.issues.compressed_assets.la-rollout']}
            {fields['performance.issues.compressed_assets.ea-rollout']}
            {fields['performance.issues.compressed_assets.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>{t('Performance Issues - File IO on Main Thread')}</PanelHeader>
            {fields['performance.issues.file_io_main_thread.problem-creation']}
          </Panel>
          <Panel>
            <PanelHeader>{t('Performance Issues - Slow DB Span Detector')}</PanelHeader>
            {fields['performance.issues.slow_db_query.problem-creation']}
            {fields['performance.issues.slow_db_query.la-rollout']}
            {fields['performance.issues.slow_db_query.ea-rollout']}
            {fields['performance.issues.slow_db_query.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>
              {t('Performance Issues - Large Render Blocking Asset Detector')}
            </PanelHeader>
            {fields['performance.issues.render_blocking_assets.problem-creation']}
            {fields['performance.issues.render_blocking_assets.la-rollout']}
            {fields['performance.issues.render_blocking_assets.ea-rollout']}
            {fields['performance.issues.render_blocking_assets.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>{t('Performance Issues - MN+1 DB Detector')}</PanelHeader>
            {fields['performance.issues.m_n_plus_one_db.problem-creation']}
            {fields['performance.issues.m_n_plus_one_db.la-rollout']}
            {fields['performance.issues.m_n_plus_one_db.ea-rollout']}
            {fields['performance.issues.m_n_plus_one_db.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>
              {t('Performance Issues - Consecutive HTTP Span Detector')}
            </PanelHeader>
            {fields['performance.issues.consecutive_http.max_duration_between_spans']}
            {fields['performance.issues.consecutive_http.consecutive_count_threshold']}
            {fields['performance.issues.consecutive_http.span_duration_threshold']}
          </Panel>
          <Panel>
            <PanelHeader>
              {t('Performance Issues - Large HTTP Payload Detector')}
            </PanelHeader>
            {fields['performance.issues.large_http_payload.size_threshold']}
          </Panel>
          <Panel>
            <PanelHeader>
              {t('Profiling Issues - Block Main Thread Detector Ingest')}
            </PanelHeader>
            {fields['profile.issues.blocked_main_thread-ingest.la-rollout']}
            {fields['profile.issues.blocked_main_thread-ingest.ea-rollout']}
            {fields['profile.issues.blocked_main_thread-ingest.ga-rollout']}
          </Panel>
          <Panel>
            <PanelHeader>
              {t('Profiling Issues - Block Main Thread Detector Post Process Group')}
            </PanelHeader>
            {fields['profile.issues.blocked_main_thread-ppg.la-rollout']}
            {fields['profile.issues.blocked_main_thread-ppg.ea-rollout']}
            {fields['profile.issues.blocked_main_thread-ppg.ga-rollout']}
          </Panel>
        </Feature>
        <Feature features="organizations:view-hierarchies-options-dev">
          <Panel>
            <PanelHeader>{t('View Hierarchy')}</PanelHeader>
          </Panel>
        </Feature>
      </Form>
    </div>
  );
}
