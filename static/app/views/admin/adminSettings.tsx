import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Form} from 'sentry/components/forms';
import {Panel, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import AsyncView from 'sentry/views/asyncView';

import {getOption, getOptionField} from './options';

const manualDetectionOptions = [
  'performance.issues.n_plus_one_db.problem-creation',
  'performance.issues.n_plus_one_db_ext.problem-creation',
  'performance.issues.n_plus_one_db.count_threshold',
  'performance.issues.n_plus_one_db.duration_threshold',
  'performance.issues.file_io_main_thread.problem-creation',
];

// For rollout options backed by `AutoRegisterOptionBackedRolloutFeatureHandler`
export const autoRegisterDetectorOptions: Array<{
  detectorName: string;
  namespace: string;
}> = [
  {
    namespace: 'performance.issues.consecutive_db',
    detectorName: 'Consecutive DB',
  },
  {
    namespace: 'performance.issues.n_plus_one_api_calls',
    detectorName: 'N+1 API Calls',
  },
  {
    namespace: 'performance.issues.compressed_assets',
    detectorName: 'Compressed Assets',
  },
  {
    namespace: 'performance.issues.slow_db_query',
    detectorName: 'Slow DB Span',
  },
  {
    namespace: 'performance.issues.render_blocking_assets',
    detectorName: 'Large Render Blocking Assets',
  },
];

export const autoRegisterCohorts = ['la', 'ea', 'ga'];

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
  ...manualDetectionOptions,
  ...autoRegisterDetectorOptions.flatMap(option => [
    `${option.namespace}.problem-creation`,
    ...autoRegisterCohorts.map(cohort => `${option.namespace}.${cohort}-rollout`),
  ]),
];

type Field = ReturnType<typeof getOption>;

type FieldDef = {
  field: Field;
  value: string | undefined;
};

type State = AsyncView['state'] & {
  data: Record<string, FieldDef>;
};

export default class AdminSettings extends AsyncView<{}, State> {
  get endpoint() {
    return '/internal/options/';
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['data', this.endpoint]];
  }

  renderBody() {
    const {data} = this.state;

    const initialData = {};
    const fields = {};
    for (const key of optionsAvailable) {
      // TODO(dcramer): we should not be mutating options
      const option = data[key] ?? {field: {}, value: undefined};

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
          apiEndpoint={this.endpoint}
          initialData={initialData}
          saveOnBlur
        >
          <Panel>
            <PanelHeader>General</PanelHeader>
            {fields['system.url-prefix']}
            {fields['system.admin-email']}
            {fields['system.support-email']}
            {fields['system.security-email']}
            {fields['system.rate-limit']}
          </Panel>

          <Panel>
            <PanelHeader>Security & Abuse</PanelHeader>
            {fields['auth.allow-registration']}
            {fields['auth.ip-rate-limit']}
            {fields['auth.user-rate-limit']}
            {fields['api.rate-limit.org-create']}
          </Panel>

          <Panel>
            <PanelHeader>Beacon</PanelHeader>
            {fields['beacon.anonymous']}
          </Panel>

          <Feature features={['organizations:performance-issues-dev']}>
            <Panel>
              <PanelHeader>Performance Issues - All</PanelHeader>
              {fields['performance.issues.all.problem-detection']}
            </Panel>
            <Panel>
              <PanelHeader>Performance Issues - Detectors</PanelHeader>
              {fields['performance.issues.n_plus_one_db.problem-creation']}
              {fields['performance.issues.n_plus_one_db_ext.problem-creation']}
              {fields['performance.issues.n_plus_one_db.count_threshold']}
              {fields['performance.issues.n_plus_one_db.duration_threshold']}
            </Panel>

            <Panel>
              <PanelHeader>Performance Issues - File IO on Main Thread</PanelHeader>
              {fields['performance.issues.file_io_main_thread.problem-creation']}
            </Panel>

            {autoRegisterDetectorOptions.map(option => (
              <Panel key={option.namespace}>
                <PanelHeader>Performance Issue - {option.detectorName}</PanelHeader>
                {fields[`performance.issues.${option.namespace}.problem-creation`]}
                {autoRegisterCohorts.map(cohort => (
                  <Fragment key={cohort}>
                    {fields[`performance.issues.${option.namespace}.${cohort}-rollout`]}
                  </Fragment>
                ))}
              </Panel>
            ))}
          </Feature>
        </Form>
      </div>
    );
  }
}
