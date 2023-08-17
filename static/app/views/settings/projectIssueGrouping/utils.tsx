import type {AlertProps} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {EventGroupingConfig, Project} from 'sentry/types';

export function getGroupingChanges(
  project: Project,
  groupingConfigs: EventGroupingConfig[]
): {
  latestGroupingConfig: EventGroupingConfig | null;
  riskLevel: number;
  updateNotes: string;
} {
  const byId: Record<string, EventGroupingConfig> = {};
  let updateNotes: string = '';
  let riskLevel: number = 0;
  let latestGroupingConfig: EventGroupingConfig | null = null;

  groupingConfigs.forEach(cfg => {
    byId[cfg.id] = cfg;
    if (cfg.latest && project.groupingConfig !== cfg.id) {
      updateNotes = cfg.changelog;
      latestGroupingConfig = cfg;
      riskLevel = cfg.risk;
    }
  });

  if (latestGroupingConfig) {
    let next = (latestGroupingConfig as EventGroupingConfig).base ?? '';
    while (next !== project.groupingConfig) {
      const cfg = byId[next];
      if (!cfg) {
        break;
      }
      riskLevel = Math.max(riskLevel, cfg.risk);
      updateNotes = cfg.changelog + '\n' + updateNotes;
      next = cfg.base ?? '';
    }
  }

  return {updateNotes, riskLevel, latestGroupingConfig};
}

export function getGroupingRisk(riskLevel: number): {
  alertType: AlertProps['type'];
  riskNote: React.ReactNode;
} {
  switch (riskLevel) {
    case 0:
      return {
        riskNote: t('This upgrade has the chance to create some new issues.'),
        alertType: 'info',
      };
    case 1:
      return {
        riskNote: t('This upgrade will create some new issues.'),
        alertType: 'warning',
      };
    case 2:
      return {
        riskNote: (
          <strong>
            {t(
              'The new grouping strategy is incompatible with the current and will create entirely new issues.'
            )}
          </strong>
        ),
        alertType: 'error',
      };
    default:
      return {riskNote: undefined, alertType: undefined};
  }
}
