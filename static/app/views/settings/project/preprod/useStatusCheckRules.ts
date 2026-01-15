import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

import {MEASUREMENT_OPTIONS, METRIC_OPTIONS, type StatusCheckRule} from './types';

const ENABLED_KEY = 'sentry:preprod_size_status_checks_enabled';
const RULES_KEY = 'sentry:preprod_size_status_checks_rules';

const DEFAULT_METRIC = METRIC_OPTIONS[0]!.value;
const DEFAULT_MEASUREMENT = MEASUREMENT_OPTIONS[0]!.value;

const VALID_METRICS: string[] = METRIC_OPTIONS.map(o => o.value);
const VALID_MEASUREMENTS: string[] = MEASUREMENT_OPTIONS.map(o => o.value);

function parseRules(raw: unknown): StatusCheckRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r.id === 'string')
    .map(r => {
      const metric = VALID_METRICS.includes(r.metric as string)
        ? (r.metric as StatusCheckRule['metric'])
        : DEFAULT_METRIC;
      const measurement = VALID_MEASUREMENTS.includes(r.measurement as string)
        ? (r.measurement as StatusCheckRule['measurement'])
        : DEFAULT_MEASUREMENT;
      return {
        id: r.id as string,
        metric,
        measurement,
        value: typeof r.value === 'number' ? r.value : 0,
        filterQuery: typeof r.filterQuery === 'string' ? r.filterQuery : '',
      };
    });
}

export function useStatusCheckRules(project: Project) {
  const updateProject = useUpdateProject(project);

  const enabled = project.options?.[ENABLED_KEY] !== false;
  const rulesJson = project.options?.[RULES_KEY];
  const rules: StatusCheckRule[] = useMemo(() => {
    if (typeof rulesJson !== 'string') {
      return [];
    }
    try {
      return parseRules(JSON.parse(rulesJson));
    } catch {
      return [];
    }
  }, [rulesJson]);

  const config = {enabled, rules};

  const updateConfig = useCallback(
    (newOptions: Record<string, string | boolean>, successMessage?: string) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {
          options: newOptions,
        },
        {
          onSuccess: () => {
            if (successMessage) {
              addSuccessMessage(successMessage);
            }
          },
          onError: () => {
            addErrorMessage(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject]
  );

  const setEnabled = useCallback(
    (value: boolean) => {
      updateConfig(
        {[ENABLED_KEY]: value},
        value ? t('Status checks enabled.') : t('Status checks disabled.')
      );
    },
    [updateConfig]
  );

  const saveRules = useCallback(
    (newRules: StatusCheckRule[], successMessage?: string) => {
      updateConfig({[RULES_KEY]: JSON.stringify(newRules)}, successMessage);
    },
    [updateConfig]
  );

  const addRule = useCallback(
    (rule: StatusCheckRule) => {
      saveRules([...rules, rule], t('Status check rule created.'));
    },
    [rules, saveRules]
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<StatusCheckRule>) => {
      const newRules = rules.map(r => (r.id === id ? {...r, ...updates} : r));
      saveRules(newRules, t('Status check rule saved.'));
    },
    [rules, saveRules]
  );

  const deleteRule = useCallback(
    (id: string) => {
      const newRules = rules.filter(r => r.id !== id);
      saveRules(newRules, t('Status check rule deleted.'));
    },
    [rules, saveRules]
  );

  const createEmptyRule = useCallback((): StatusCheckRule => {
    return {
      id: crypto.randomUUID(),
      metric: DEFAULT_METRIC,
      measurement: DEFAULT_MEASUREMENT,
      value: 0,
      filterQuery: '',
    };
  }, []);

  return {
    config,
    setEnabled,
    addRule,
    updateRule,
    deleteRule,
    createEmptyRule,
  };
}
