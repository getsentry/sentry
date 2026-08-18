import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useCodingAgents} from 'sentry/components/events/autofix/v3/useCodingAgents';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  IconAdd,
  IconChevron,
  IconCode,
  IconCommit,
  IconSearch,
  IconSeer,
} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AutofixStateKey, OverviewRun} from './types';

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
  // Absent when the trigger surfaces its own error toast.
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

export function OverviewCardAction({
  run,
  sectionKey,
  issueUrl,
}: {
  issueUrl: string;
  run: OverviewRun;
  sectionKey: ActionableSectionKey;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const config = ACTIONS[sectionKey];
  const [dispatched, setDispatched] = useState(false);
  // Agent options are only needed once the dropdown opens; deferring the
  // fetches avoids draining per-project repo pagination for every card.
  const [menuOpened, setMenuOpened] = useState(false);

  const autofix = useExplorerAutofix(
    {id: run.groupId, shortId: run.shortId},
    {
      enabled: false,
      codingAgentAnalyticsSource: 'overview',
      onCodingAgentError: messages =>
        messages.forEach(message => addErrorMessage(message)),
    }
  );

  const {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff} =
    useCodingAgents({
      autofix,
      group: {id: run.groupId, project: run.issue.project},
      runId: run.seerRunId,
      step: config.handoffStep,
      referrer: 'autofix-overview',
      enabled: menuOpened,
    });

  const menuItems = useMemo<MenuItemProps[]>(() => {
    const agentItems = (codingAgentIntegrations ?? []).map(integration => {
      const actionLabel =
        integration.requires_identity && !integration.has_identity
          ? t('Setup %s', integration.name)
          : t('Send to %s', integration.name);
      return {
        key: `agent:${integration.id ?? integration.provider}`,
        textValue: actionLabel,
        label: (
          <Flex gap="md" align="center">
            <PluginIcon pluginId={integration.provider} size={16} />
            <span>{actionLabel}</span>
          </Flex>
        ),
        disabled: defined(codingAgentDisabledReason),
        tooltip: codingAgentDisabledReason,
        onAction: () => handleCodingAgentHandoff(integration),
      };
    });

    return [
      {
        key: 'open-seer',
        textValue: t('Open Seer'),
        label: (
          <Flex gap="md" align="center">
            <IconSeer size="sm" />
            <span>{t('Open Seer')}</span>
          </Flex>
        ),
        to: {pathname: issueUrl, query: {seerDrawer: 'true'}},
        onAction: () =>
          trackAnalytics('autofix.overview.open_seer_clicked', {
            organization,
            group_id: run.groupId,
            run_id: run.seerRunId,
          }),
      },
      ...agentItems,
    ];
  }, [
    codingAgentIntegrations,
    codingAgentDisabledReason,
    handleCodingAgentHandoff,
    issueUrl,
    organization,
    run.groupId,
    run.seerRunId,
  ]);

  if (dispatched) {
    return (
      <Button size="sm" variant="secondary" disabled icon={<ButtonSpinner size={14} />}>
        {config.busyLabel}
      </Button>
    );
  }

  const handleTrigger = async () => {
    setDispatched(true);
    trackAnalytics('autofix.overview.action_clicked', {
      organization,
      group_id: run.groupId,
      run_id: run.seerRunId,
      action: config.action,
    });
    try {
      await config.trigger(autofix, run.seerRunId);
      // Mark the overview stale so mounted lists refetch and can re-bucket the
      // card once the backend reflects the new milestone.
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/seer/autofix-overview/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
    } catch (error: any) {
      if (config.errorFallback) {
        addErrorMessage(error?.responseJSON?.detail ?? config.errorFallback);
      }
      setDispatched(false);
    }
  };

  return (
    <ButtonBar>
      <Tooltip title={config.description} skipWrapper>
        <Button
          size="sm"
          variant="secondary"
          icon={<config.Icon />}
          onClick={handleTrigger}
        >
          {config.label}
        </Button>
      </Tooltip>
      <DropdownMenu
        items={menuItems}
        trigger={(triggerProps, isOpen) => (
          <Button
            {...triggerProps}
            size="sm"
            variant="secondary"
            icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
            aria-label={t('More Seer options')}
          />
        )}
        position="bottom-end"
        shouldCloseOnBlur={false}
        onOpenChange={isOpen => isOpen && setMenuOpened(true)}
        menuFooter={
          <DropdownMenuFooter>
            <MenuComponents.CTALinkButton
              icon={<IconAdd />}
              to={`/settings/${organization.slug}/integrations/?category=coding%20agent`}
            >
              {t('Add Integration')}
            </MenuComponents.CTALinkButton>
          </DropdownMenuFooter>
        }
      />
    </ButtonBar>
  );
}

const ButtonSpinner = styled(LoadingIndicator)`
  margin: 0;
`;
