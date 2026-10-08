import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixDebugMenu} from 'sentry/components/events/autofix/v3/autofixDebugMenu';
import {IconBot} from 'sentry/icons/iconBot';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface SeerPanelActionsProps {
  autofixState?: ExplorerAutofixState | null;
  enableBashMode?: boolean;
  onCopyMarkdown?: () => void;
  onEnableBashModeChange?: (enabled: boolean) => void;
  onOpenSeerAgent?: () => void;
  onReset?: () => void;
}

/**
 * Just the toolbar. The drawer keeps it beside the panel title; the autofix tab
 * lifts it into the issue navigation row, alongside the tabs.
 */
export function SeerPanelActions({
  autofixState,
  enableBashMode,
  onCopyMarkdown,
  onEnableBashModeChange,
  onOpenSeerAgent,
  onReset,
}: SeerPanelActionsProps) {
  const organization = useOrganization();
  const hasDebugFlag = organization.features.includes('autofix-seer-agent-debug');
  const isSentryEmployee = useIsSentryEmployee();

  return (
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
      {isSentryEmployee && onEnableBashModeChange && (
        <Tooltip title={t('Force bash mode on for the autofix analysis')} skipWrapper>
          <Flex align="center" gap="xs">
            <Text size="xs">{t('Bash')}</Text>
            <Switch
              checked={enableBashMode ?? false}
              onChange={() => onEnableBashModeChange(!enableBashMode)}
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
  );
}
