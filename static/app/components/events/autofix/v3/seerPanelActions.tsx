import {IconBot} from '@sentry/icons/bot';
import {IconMarkdown} from '@sentry/icons/markdown';
import {IconRefresh} from '@sentry/icons/refresh';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AutofixDebugMenu} from './autofixDebugMenu';

export interface SeerPanelActionsProps {
  autofixState?: ExplorerAutofixState | null;
  onCopyMarkdown?: () => void;
  onOpenSeerAgent?: () => void;
  onReset?: () => void;
}

/**
 * Just the toolbar. The drawer keeps it beside the panel title; the autofix tab
 * lifts it into the issue navigation row, alongside the tabs.
 */
export function SeerPanelActions({
  autofixState,
  onCopyMarkdown,
  onOpenSeerAgent,
  onReset,
}: SeerPanelActionsProps) {
  const organization = useOrganization();
  const hasDebugFlag = organization.features.includes('autofix-seer-agent-debug');
  const isSentryEmployee = useIsSentryEmployee();

  return (
    <Flex align="center" gap="xs">
      <AutofixDebugMenu autofixState={autofixState} />
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
        icon={<IconMarkdown />}
        onClick={onCopyMarkdown}
        disabled={!onCopyMarkdown}
        tooltipProps={{title: t('Copy analysis as Markdown')}}
        aria-label={t('Copy analysis as Markdown')}
        variant="transparent"
      />
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
