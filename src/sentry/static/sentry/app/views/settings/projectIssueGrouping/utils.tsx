import React from 'react';

import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {EventGroupingConfig, GroupingEnhancementBase, Project} from 'app/types';

export function getGroupingChanges(
  project: Project,
  groupingConfigs: EventGroupingConfig[],
  groupingEnhancementBases: GroupingEnhancementBase[]
): {
  updateNotes: string;
  riskLevel: number;
  latestGroupingConfig: EventGroupingConfig | null;
  latestEnhancementsBase: GroupingEnhancementBase | null;
} {
  const byId: Record<string, EventGroupingConfig> = {};
  let updateNotes: string = '';
  let riskLevel: number = 0;
  let latestGroupingConfig: EventGroupingConfig | null = null;
  let latestEnhancementsBase: GroupingEnhancementBase | null = null;

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

  groupingEnhancementBases.forEach(base => {
    if (base.latest && project.groupingEnhancementsBase !== base.id) {
      updateNotes += '\n\n' + base.changelog;
      latestEnhancementsBase = base;
    }
  });

  return {updateNotes, riskLevel, latestGroupingConfig, latestEnhancementsBase};
}

export function getGroupingRisk(
  riskLevel: number
): {
  riskNote: React.ReactNode;
  alertType: React.ComponentProps<typeof Alert>['type'];
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
