import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonBar, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useAutofixCreatePrGate} from 'sentry/components/events/autofix/useAutofixCreatePrGate';
import {
  CodingAgentMenuFooter,
  useCodingAgentMenuItems,
} from 'sentry/components/events/autofix/v3/codingAgentMenu';
import {useCodingAgents} from 'sentry/components/events/autofix/v3/useCodingAgents';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconChevron, IconOpen, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';

import {useOpenSeerLink} from './openSeerButton';
import {type ActionableSectionKey, useNextAction} from './overviewActions';
import type {OverviewRun} from './types';

export function OverviewCardAction({
  run,
  sectionKey,
}: {
  run: OverviewRun;
  sectionKey: ActionableSectionKey;
}) {
  // Defer agent-option fetches until the dropdown opens to avoid per-card repo pagination.
  const [menuOpened, setMenuOpened] = useState(false);

  const {autofix, config, isDispatched, trigger} = useNextAction({run, sectionKey});
  const {to: openSeerTo, trackOpen} = useOpenSeerLink(run);

  const {hasReposConnected, hasNonGithubRepo} = run.issue.project;
  const repoEligibility =
    hasReposConnected === undefined
      ? undefined
      : {hasReposConnected, hasNonGithubRepo: hasNonGithubRepo ?? false};

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

  const agentItems = useCodingAgentMenuItems({
    codingAgentIntegrations,
    codingAgentDisabledReason,
    onCodingAgentHandoff: handleCodingAgentHandoff,
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
  }, [isLoadingOptions, agentItems, openSeerTo, trackOpen]);

  if (isDispatched) {
    return (
      <Button size="sm" variant="secondary" disabled icon={<ButtonSpinner size={14} />}>
        {config.busyLabel}
      </Button>
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
    <ButtonBar>
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
        menuFooter={<CodingAgentMenuFooter />}
      />
    </ButtonBar>
  );
}

export const ButtonSpinner = styled(LoadingIndicator)`
  margin: 0;
`;
