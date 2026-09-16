import {useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {getReferrerConfig} from 'sentry/components/events/autofix/autofixReferrer';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {getConversationHref} from 'sentry/components/seer/markdown/embeds/components/conversation/conversationLink';
import {SEER_AGENTS_PROJECT_ID} from 'sentry/constants';
import {IconBot} from 'sentry/icons/iconBot';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerDrawerHeaderProps {
  autofixState?: ExplorerAutofixState | null;
  enableBashTools?: boolean;
  onCopyMarkdown?: () => void;
  onEnableBashToolsChange?: (enabled: boolean) => void;
  onOpenSeerAgent?: () => void;
  onReset?: () => void;
  referrer?: string;
}

export function SeerDrawerHeader({
  autofixState,
  enableBashTools,
  onCopyMarkdown,
  onEnableBashToolsChange,
  onOpenSeerAgent,
  onReset,
  referrer,
}: SeerDrawerHeaderProps) {
  const organization = useOrganization();
  const hasDebugFlag = organization.features.includes('autofix-seer-agent-debug');
  const isSentryEmployee = useIsSentryEmployee();
  const tooltip = useMemo(() => {
    const config = getReferrerConfig(referrer);
    return config.tooltip ?? referrer;
  }, [referrer]);

  return (
    <DrawerHeader hideBar hideCloseButtonText>
      <Flex justify="between" width="100%">
        <Flex align="center" gap="xs">
          <Text>{t('Seer Autofix')}</Text>
          {tooltip && <InfoTip title={tooltip} size="xs" />}
        </Flex>
        <Flex align="center" gap="xs">
          {isSentryEmployee && <AutofixDebugMenu autofixState={autofixState} />}
          <Button
            size="xs"
            icon={<IconRefresh />}
            onClick={onReset}
            disabled={!onReset}
            tooltipProps={{title: t('Start a new analysis from scratch')}}
            aria-label={t('Start a new analysis from scratch')}
            variant="transparent"
          />
          <Button
            size="xs"
            icon={<IconCopy />}
            onClick={onCopyMarkdown}
            disabled={!onCopyMarkdown}
            tooltipProps={{title: t('Copy analysis as Markdown')}}
            aria-label={t('Copy analysis as Markdown')}
            variant="transparent"
          />
          {isSentryEmployee && onEnableBashToolsChange && (
            <Tooltip title={t('Force bash mode on for the autofix analysis')} skipWrapper>
              <Flex align="center" gap="xs">
                <Text size="xs">{t('Bash')}</Text>
                <Switch
                  checked={enableBashTools ?? false}
                  onChange={() => onEnableBashToolsChange(!enableBashTools)}
                  aria-label={t('Enable bash tools')}
                />
              </Flex>
            </Tooltip>
          )}
          {isSentryEmployee && hasDebugFlag && onOpenSeerAgent && (
            <Button
              size="xs"
              icon={<IconBot />}
              onClick={onOpenSeerAgent}
              tooltipProps={{title: t('Open in Seer Agent (debug)')}}
              aria-label={t('Open in Seer Agent (debug)')}
              variant="transparent"
            />
          )}
        </Flex>
      </Flex>
    </DrawerHeader>
  );
}

function AutofixDebugMenu({
  autofixState,
}: {
  autofixState: ExplorerAutofixState | null | undefined;
}) {
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();
  const runId = getAutofixRunId(autofixState);

  if (!isSentryEmployee || !autofixState || runId === undefined) {
    return null;
  }

  const timestamps = autofixState.blocks
    .map(block => Date.parse(block.timestamp))
    .filter(timestamp => !Number.isNaN(timestamp));

  const href = getConversationHref(
    {
      id: String(runId),
      projects: [String(SEER_AGENTS_PROJECT_ID)],
      ...(timestamps.length
        ? {
            start: new Date(Math.min(...timestamps)).toISOString(),
            end: new Date(Math.max(...timestamps)).toISOString(),
          }
        : {}),
    },
    organization.slug,
    'issue-details-autofix-debug'
  );

  const items: MenuItemProps[] = [
    {
      key: 'autofix-conversation',
      label: t('Open agent trace'),
      leadingItems: <IconOpen />,
      externalHref: href,
    },
  ];

  return (
    <DropdownMenu
      items={items}
      size="xs"
      position="bottom-end"
      triggerLabel={t('Debug')}
      triggerProps={{
        'aria-label': t('Debug'),
        icon: <IconBug />,
        variant: 'transparent',
        size: 'xs',
      }}
    />
  );
}
