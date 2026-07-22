import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {uniqueId} from 'sentry/utils/guid';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

import {
  DEFAULT_ARTIFACT_TYPE,
  DEFAULT_MEASUREMENT_TYPE,
  DEFAULT_METRIC_TYPE,
  toArtifactType,
  toMeasurementType,
  toMetricType,
  type StatusCheckRule,
} from './types';

type EnabledField = 'preprodSizeStatusChecksEnabled' | 'preprodSizePrCommentsEnabled';

type RulesField = 'preprodSizeStatusChecksRules' | 'preprodSizePrCommentsRules';

export interface SizeRulesConfig {
  /** Whether the feature is enabled when neither field nor option is set. */
  defaultEnabled: boolean;
  /** Top-level project field that mirrors the enabled flag (optimistic update). */
  enabledField: EnabledField;
  /** Project option key that stores the enabled flag (server response). */
  enabledOptionKey: string;
  /** Top-level project field that mirrors the rules array (optimistic update). */
  rulesField: RulesField;
  /** Project option key that stores the rules array (server response). */
  rulesOptionKey: string;
  toasts: {
    created: string;
    deleted: string;
    disabled: string;
    enabled: string;
    saved: string;
  };
}

function parseRules(raw: unknown): StatusCheckRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r.id === 'string')
    .map(r => {
      const metric = toMetricType(r.metric, DEFAULT_METRIC_TYPE);
      const measurement = toMeasurementType(r.measurement, DEFAULT_MEASUREMENT_TYPE);
      const artifactType = toArtifactType(r.artifactType);
      return {
        id: r.id as string,
        metric,
        measurement,
        value: typeof r.value === 'number' ? r.value : 0,
        filterQuery: typeof r.filterQuery === 'string' ? r.filterQuery : '',
        artifactType,
      };
    });
}

export function useSizeRules(project: DetailedProject, config: SizeRulesConfig) {
  const updateProject = useUpdateProject(project);

  // Check top-level field first (optimistic update), fallback to options (server
  // response), then to the configured default.
  const enabledOption = project.options?.[config.enabledOptionKey];
  const enabled =
    project[config.enabledField] ??
    (enabledOption === undefined ? config.defaultEnabled : enabledOption === true);

  const rulesRaw =
    (project[config.rulesField] as unknown) ?? project.options?.[config.rulesOptionKey];
  const rules = useMemo(() => {
    if (Array.isArray(rulesRaw)) {
      return parseRules(rulesRaw);
    }
    if (typeof rulesRaw !== 'string') {
      return [];
    }
    try {
      return parseRules(JSON.parse(rulesRaw));
    } catch {
      return [];
    }
  }, [rulesRaw]);

  const settingConfig = {enabled, rules};

  const setEnabled = useCallback(
    (value: boolean) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate({[config.enabledField]: value} as Partial<DetailedProject>, {
        onSuccess: () => {
          addSuccessMessage(value ? config.toasts.enabled : config.toasts.disabled);
        },
        onError: () => {
          addErrorMessage(t('Failed to save changes. Please try again.'));
        },
      });
    },
    [updateProject, config.enabledField, config.toasts]
  );

  const saveRules = useCallback(
    (newRules: StatusCheckRule[], successMessage?: string) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {[config.rulesField]: newRules as unknown[]} as Partial<DetailedProject>,
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
    [updateProject, config.rulesField]
  );

  const addRule = useCallback(
    (rule: StatusCheckRule) => {
      saveRules([...rules, rule], config.toasts.created);
    },
    [rules, saveRules, config.toasts.created]
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<StatusCheckRule>) => {
      const newRules = rules.map(r => (r.id === id ? {...r, ...updates} : r));
      saveRules(newRules, config.toasts.saved);
    },
    [rules, saveRules, config.toasts.saved]
  );

  const deleteRule = useCallback(
    (id: string) => {
      const newRules = rules.filter(r => r.id !== id);
      saveRules(newRules, config.toasts.deleted);
    },
    [rules, saveRules, config.toasts.deleted]
  );

  const createEmptyRule = useCallback((): StatusCheckRule => {
    return {
      id: uniqueId(),
      metric: DEFAULT_METRIC_TYPE,
      measurement: DEFAULT_MEASUREMENT_TYPE,
      value: 0,
      filterQuery: '',
      artifactType: DEFAULT_ARTIFACT_TYPE,
    };
  }, []);

  return {
    config: settingConfig,
    setEnabled,
    addRule,
    updateRule,
    deleteRule,
    createEmptyRule,
  };
}
