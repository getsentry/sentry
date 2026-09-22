import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {getConversationHref} from 'sentry/components/seer/markdown/embeds/components/conversation/conversationLink';
import {SEER_AGENTS_PROJECT_ID} from 'sentry/constants';
import {IconBug} from 'sentry/icons/iconBug';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AutofixDebugMenu({
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
