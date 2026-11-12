import {IconBug} from '@sentry/icons/bug';
import {IconOpen} from '@sentry/icons/open';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {getConversationHref} from 'sentry/components/seer/markdown/embeds/components/conversation/conversationLink';
import {SEER_AGENTS_PROJECT_ID} from 'sentry/constants';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

interface AutofixDebugMenuProps {
  autofixState: ExplorerAutofixState | null | undefined;
}

export function AutofixDebugMenu({autofixState}: AutofixDebugMenuProps) {
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();

  if (!isSentryEmployee) {
    return null;
  }

  const items: MenuItemProps[] = [];

  const conversationHref = getConversationHrefForState(autofixState, organization.slug);
  if (conversationHref) {
    items.push({
      key: 'autofix-conversation',
      label: t('Open agent trace'),
      leadingItems: <IconOpen />,
      externalHref: conversationHref,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      items={items}
      size="xs"
      position="bottom-end"
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          aria-label={t('Debug')}
          icon={<IconBug />}
          variant="transparent"
        >
          {t('Debug')}
        </OverlayTrigger.Button>
      )}
    />
  );
}

function getConversationHrefForState(
  autofixState: ExplorerAutofixState | null | undefined,
  orgSlug: string
) {
  const runId = getAutofixRunId(autofixState);
  if (!autofixState || runId === undefined) {
    return;
  }

  const timestamps = autofixState.blocks
    .map(block => Date.parse(block.timestamp))
    .filter(timestamp => !Number.isNaN(timestamp));

  return getConversationHref(
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
    orgSlug,
    'issue-details-autofix-debug'
  );
}
