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

const ENABLED_KEY = 'sentry:preprod_size_pr_comments_enabled';
const RULES_KEY = 'sentry:preprod_size_pr_comments_rules';

const DEFAULT_METRIC = DEFAULT_METRIC_TYPE;
const DEFAULT_MEASUREMENT = DEFAULT_MEASUREMENT_TYPE;

function parseRules(raw: unknown): StatusCheckRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r.id === 'string')
    .map(r => {
      const metric = toMetricType(r.metric, DEFAULT_METRIC);
      const measurement = toMeasurementType(r.measurement, DEFAULT_MEASUREMENT);
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

export function usePrCommentRules(project: DetailedProject) {
  const updateProject = useUpdateProject(project);

  const enabled =
    project.preprodSizePrCommentsEnabled ?? project.options?.[ENABLED_KEY] === true;

  const rulesRaw = project.preprodSizePrCommentsRules ?? project.options?.[RULES_KEY];
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

  const config = {enabled, rules};

  const setEnabled = useCallback(
    (value: boolean) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {preprodSizePrCommentsEnabled: value},
        {
          onSuccess: () => {
            addSuccessMessage(
              value ? t('PR comments enabled.') : t('PR comments disabled.')
            );
          },
          onError: () => {
            addErrorMessage(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject]
  );

  const saveRules = useCallback(
    (newRules: StatusCheckRule[], successMessage?: string) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {preprodSizePrCommentsRules: newRules as unknown[]},
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

  const addRule = useCallback(
    (rule: StatusCheckRule) => {
      saveRules([...rules, rule], t('PR comment rule created.'));
    },
    [rules, saveRules]
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<StatusCheckRule>) => {
      const newRules = rules.map(r => (r.id === id ? {...r, ...updates} : r));
      saveRules(newRules, t('PR comment rule saved.'));
    },
    [rules, saveRules]
  );

  const deleteRule = useCallback(
    (id: string) => {
      const newRules = rules.filter(r => r.id !== id);
      saveRules(newRules, t('PR comment rule deleted.'));
    },
    [rules, saveRules]
  );

  const createEmptyRule = useCallback((): StatusCheckRule => {
    return {
      id: uniqueId(),
      metric: DEFAULT_METRIC,
      measurement: DEFAULT_MEASUREMENT,
      value: 0,
      filterQuery: '',
      artifactType: DEFAULT_ARTIFACT_TYPE,
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
