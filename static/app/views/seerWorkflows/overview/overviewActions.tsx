import {useCallback, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconCode, IconCommit, IconSearch} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AutofixStateKey, MilestoneKey, OverviewRun} from './types';
import {OVERVIEW_SECTIONS} from './types';

export type ActionableSectionKey = Exclude<AutofixStateKey, 'merged' | 'review_pr'>;

interface ActionConfig {
  Icon: React.ComponentType<SVGIconProps>;
  action: 'create_plan' | 'generate_code' | 'draft_pr';
  busyLabel: string;
  description: string;
  handoffStep: 'root_cause' | 'solution' | 'code_changes';
  label: string;
  trigger: (
    autofix: Pick<ReturnType<typeof useExplorerAutofix>, 'startStep' | 'createPR'>,
    runId: string
  ) => Promise<unknown>;
  errorFallback?: string;
}

const ACTIONS: Record<ActionableSectionKey, ActionConfig> = {
  needs_investigation: {
    Icon: IconSearch,
    action: 'create_plan',
    busyLabel: t('Creating Plan…'),
    description: t('Seer stopped at a diagnosis. Review the root cause to continue.'),
    errorFallback: t('Seer could not start creating a plan.'),
    handoffStep: 'root_cause',
    label: t('Create Plan'),
    trigger: (autofix, runId) => autofix.startStep('solution', {runId}),
  },
  solution_ready: {
    Icon: IconCode,
    action: 'generate_code',
    busyLabel: t('Generating Code…'),
    description: t('Autofix proposed a fix. Continue the pipeline to generate code.'),
    errorFallback: t('Seer could not start generating code.'),
    handoffStep: 'solution',
    label: t('Generate code'),
    trigger: (autofix, runId) => autofix.startStep('code_changes', {runId}),
  },
  code_changes_ready: {
    Icon: IconCommit,
    action: 'draft_pr',
    busyLabel: t('Creating PR…'),
    description: t('Autofix wrote a diff. Review it and open a pull request.'),
    handoffStep: 'code_changes',
    label: t('Draft PR'),
    trigger: (autofix, runId) => autofix.createPR(runId),
  },
};

const SECTION_BY_MILESTONE = Object.fromEntries(
  OVERVIEW_SECTIONS.map(section => [section.milestone, section.key])
) as Record<MilestoneKey, AutofixStateKey>;

export function sectionKeyForMilestone(milestone: MilestoneKey): AutofixStateKey {
  return SECTION_BY_MILESTONE[milestone];
}

export function isActionableSection(
  sectionKey: AutofixStateKey
): sectionKey is ActionableSectionKey {
  return sectionKey in ACTIONS;
}

export function getProcessingLabel(sectionKey: AutofixStateKey): string {
  return isActionableSection(sectionKey) ? ACTIONS[sectionKey].busyLabel : t('Working…');
}

export function useNextAction({
  run,
  sectionKey,
}: {
  run: OverviewRun;
  sectionKey: ActionableSectionKey;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const config = ACTIONS[sectionKey];
  const [isDispatched, setIsDispatched] = useState(false);

  const autofix = useExplorerAutofix(
    {id: run.groupId, shortId: run.shortId},
    {
      enabled: false,
      codingAgentAnalyticsSource: 'overview',
      onCodingAgentError: messages =>
        messages.forEach(message => addErrorMessage(message)),
    }
  );

  const trigger = useCallback(async () => {
    setIsDispatched(true);
    trackAnalytics('autofix.overview.action_clicked', {
      organization,
      group_id: run.groupId,
      run_id: run.seerRunId,
      action: config.action,
      section: sectionKey,
    });
    try {
      await config.trigger(autofix, run.seerRunId);
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/seer/autofix-overview/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
    } catch (error) {
      if (config.errorFallback) {
        const detail = (error as RequestError)?.responseJSON?.detail;
        addErrorMessage(typeof detail === 'string' ? detail : config.errorFallback);
      }
      queryClient.removeQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/autofix/', {
            path: {organizationIdOrSlug: organization.slug, issueId: run.groupId},
          }),
        ],
      });
      setIsDispatched(false);
    }
  }, [
    autofix,
    config,
    organization,
    queryClient,
    run.groupId,
    run.seerRunId,
    sectionKey,
  ]);

  return {autofix, config, isDispatched, trigger};
}
