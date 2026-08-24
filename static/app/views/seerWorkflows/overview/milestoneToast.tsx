import {useEffect, useRef} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useAutofixCreatePrGate} from 'sentry/components/events/autofix/useAutofixCreatePrGate';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {OpenSeerButton} from './openSeerButton';
import {
  type ActionableSectionKey,
  isActionableSection,
  sectionKeyForMilestone,
  useNextAction,
} from './overviewActions';
import type {AutofixOverviewResponse, MilestoneKey, OverviewRun} from './types';
import {detectMilestoneAdvances, type MilestoneAdvance} from './useAutofixOverview';

const MILESTONE_ACTION_LABELS: Record<MilestoneKey, string> = {
  autofix_root_cause: t('Root Cause Found'),
  autofix_solution: t('Plan Created'),
  autofix_code_changes: t('Code Generated'),
  has_pull_request: t('PR Opened'),
  pull_requests_merged: t('Merged'),
};

function NextActionButton({
  run,
  sectionKey,
}: {
  run: OverviewRun;
  sectionKey: ActionableSectionKey;
}) {
  const {config, isDispatched, trigger} = useNextAction({run, sectionKey});
  const {permissionsTarget, isPending: isCreatePrGatePending} = useAutofixCreatePrGate({
    group: {id: run.groupId},
    enabled: sectionKey === 'code_changes_ready',
  });

  if (permissionsTarget) {
    return (
      <Tooltip
        title={t(
          'You need to grant write permissions for your %s integration',
          permissionsTarget.integration.provider.name
        )}
        skipWrapper
      >
        <LinkButton
          size="xs"
          variant="primary"
          icon={<IconOpen />}
          href={permissionsTarget.url}
          external
        >
          {t('Update permissions')}
        </LinkButton>
      </Tooltip>
    );
  }

  return (
    <Button
      size="xs"
      variant="secondary"
      busy={isDispatched}
      disabled={isDispatched || isCreatePrGatePending}
      icon={<config.Icon />}
      onClick={trigger}
    >
      {config.label}
    </Button>
  );
}

export function MilestoneToast({
  run,
  toMilestone,
}: {
  run: OverviewRun;
  toMilestone: MilestoneKey;
}) {
  const sectionKey = sectionKeyForMilestone(toMilestone);
  return (
    <Flex align="center" gap="md">
      <Text>{t('%s: %s', run.shortId, MILESTONE_ACTION_LABELS[toMilestone])}</Text>
      {isActionableSection(sectionKey) && run.status !== 'processing' && (
        <NextActionButton run={run} sectionKey={sectionKey} />
      )}
      <OpenSeerButton run={run} size="xs" />
    </Flex>
  );
}

function showMilestoneAdvanceToast(
  advance: MilestoneAdvance,
  organization: Organization
) {
  addSuccessMessage(
    <MilestoneToast run={advance.run} toMilestone={advance.toMilestone} />,
    {disableDismiss: true}
  );
  trackAnalytics('autofix.overview.milestone_advanced', {
    organization,
    group_id: advance.run.groupId,
    run_id: advance.run.seerRunId,
    from_milestone: advance.fromMilestone,
    to_milestone: advance.toMilestone,
  });
}

export function useMilestoneAdvanceToasts(
  data: AutofixOverviewResponse | undefined,
  dataSettled: boolean
) {
  const organization = useOrganization();
  const previousRef = useRef<AutofixOverviewResponse | undefined>(undefined);

  useEffect(() => {
    // Only diff once the source query has settled, so a stale-cache remount
    // baselines off the refetch instead of toasting advances that landed while
    // unmounted.
    if (!data || !dataSettled) {
      return;
    }
    const previous = previousRef.current;
    previousRef.current = data;
    if (!previous) {
      return;
    }
    for (const advance of detectMilestoneAdvances(previous, data)) {
      showMilestoneAdvanceToast(advance, organization);
    }
  }, [data, dataSettled, organization]);
}
