import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonBar, LinkButton} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {useAutofixCreatePrGate} from 'sentry/components/events/autofix/useAutofixCreatePrGate';
import {useCodingAgents} from 'sentry/components/events/autofix/v3/useCodingAgents';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconAdd, IconChevron, IconOpen, IconSeer} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useOpenSeerLink} from './openSeerButton';
import {type ActionableSectionKey, useNextAction} from './overviewActions';
import type {OverviewRun, ProjectConfig} from './types';

export function OverviewCardAction({
  run,
  sectionKey,
  projectConfig,
}: {
  run: OverviewRun;
  sectionKey: ActionableSectionKey;
  projectConfig?: ProjectConfig;
}) {
  const organization = useOrganization();
  // Defer agent-option fetches until the dropdown opens to avoid per-card repo pagination.
  const [menuOpened, setMenuOpened] = useState(false);

  const {autofix, config, isDispatched, trigger} = useNextAction({run, sectionKey});
  const {to: openSeerTo, trackOpen} = useOpenSeerLink(run, sectionKey);

  const repoEligibility = projectConfig
    ? {
        hasReposConnected: projectConfig.hasReposConnected,
        hasNonGithubRepo: projectConfig.hasNonGithubRepo ?? false,
      }
    : undefined;

  const {
    codingAgentIntegrations,
    codingAgentDisabledReason,
    handleCodingAgentHandoff,
    isLoading: isLoadingOptions,
  } = useCodingAgents({
    autofix,
    group: {id: run.groupId, project: run.issue.project},
    runId: run.seerRunId,
    step: config.handoffStep,
    referrer: 'autofix-overview',
    enabled: menuOpened,
    repoEligibility,
  });

  const isDraftPr = sectionKey === 'code_changes_ready';
  const {permissionsTarget, isPending: isCreatePrGatePending} = useAutofixCreatePrGate({
    group: {id: run.groupId},
    enabled: isDraftPr,
  });

  const menuItems = useMemo<MenuItemProps[]>(() => {
    if (isLoadingOptions) {
      return [
        {
          key: 'loading',
          textValue: t('Loading'),
          disabled: true,
          label: (
            <Flex justify="center" padding="sm">
              <LoadingIndicator mini size={20} />
            </Flex>
          ),
        },
      ];
    }

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
        to: openSeerTo,
        onAction: trackOpen,
      },
      ...agentItems,
    ];
  }, [
    isLoadingOptions,
    codingAgentIntegrations,
    codingAgentDisabledReason,
    handleCodingAgentHandoff,
    openSeerTo,
    trackOpen,
  ]);

  if (isDispatched) {
    return (
      <ActionButtonBar>
        <Button size="sm" variant="secondary" disabled icon={<ButtonSpinner size={14} />}>
          {config.busyLabel}
        </Button>
      </ActionButtonBar>
    );
  }

  const permissionsButton = permissionsTarget ? (
    <Tooltip
      title={t(
        'You need to grant write permissions for your %s integration',
        permissionsTarget.integration.provider.name
      )}
      skipWrapper
    >
      <LinkButton
        size="sm"
        variant="secondary"
        icon={<IconOpen />}
        href={permissionsTarget.url}
        external
      >
        {t('Update permissions')}
      </LinkButton>
    </Tooltip>
  ) : null;

  return (
    <ActionButtonBar>
      {permissionsButton ?? (
        <Tooltip title={config.description} skipWrapper>
          <Button
            size="sm"
            variant="secondary"
            icon={<config.Icon />}
            onClick={trigger}
            disabled={isCreatePrGatePending}
          >
            {config.label}
          </Button>
        </Tooltip>
      )}
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
    </ActionButtonBar>
  );
}

export const ButtonSpinner = styled(LoadingIndicator)`
  margin: 0;
`;

export const ActionButtonBar = styled(ButtonBar)`
  @container (width < ${p => p.theme.container.sm}) {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
  }
`;
