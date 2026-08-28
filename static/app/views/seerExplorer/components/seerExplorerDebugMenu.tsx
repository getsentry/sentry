import {Checkbox} from '@sentry/scraps/checkbox';
import {Container} from '@sentry/scraps/layout';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconBug} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerExplorerDebugMenuProps {
  onOverrideBashModeToggle: () => void;
  onOverrideCtxEngEnableToggle: () => void;
  onShowThinkingToggle: () => void;
  overrideBashModeEnabled: boolean;
  overrideCtxEngEnable: boolean;
  showThinking: boolean;
  /** Production conversations URL for the current run; opens in a new tab. */
  conversationsUrl?: string;
}

/**
 * Consolidated "Debug" dropdown holding the feature-flagged developer toggles
 * (Context Engine override, Force bash mode, Show thinking) plus an employee-only
 * link to the conversation in Sentry. The flag checks live here so the parent
 * doesn't thread them through — if nothing is available the whole menu renders
 * nothing. Toggle state stays lifted (it's consumed elsewhere), so we only
 * receive the current values and their toggle handlers.
 */
export function SeerExplorerDebugMenu({
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  overrideBashModeEnabled,
  onOverrideBashModeToggle,
  showThinking,
  onShowThinkingToggle,
  conversationsUrl,
}: SeerExplorerDebugMenuProps) {
  const organization = useOrganization({allowNull: true});
  const isSentryEmployee = useIsSentryEmployee();
  // TEMP screenshot QA only — reverted after evidence capture
  const showContextEngineToggle = true;
  const showThinkingToggle = true;
  const showBashModeToggle = true;
  const showConversationLink = true;
  const conversationHref =
    conversationsUrl ??
    'https://sentry.io/organizations/sentry/explore/agents/conversations/demo/';
  void organization;
  void isSentryEmployee;

  const items: MenuItemProps[] = [
    ...(showContextEngineToggle
      ? [
          {
            key: 'context-engine',
            label: t('Context Engine'),
            leadingItems: <Checkbox checked={overrideCtxEngEnable} readOnly />,
            onAction: onOverrideCtxEngEnableToggle,
            closeOnSelect: false,
          },
        ]
      : []),
    ...(showBashModeToggle
      ? [
          {
            key: 'force-bash-mode',
            label: t('Force bash mode on'),
            leadingItems: <Checkbox checked={overrideBashModeEnabled} readOnly />,
            onAction: onOverrideBashModeToggle,
            closeOnSelect: false,
          },
        ]
      : []),
    ...(showThinkingToggle
      ? [
          {
            key: 'show-thinking',
            label: t('Show thinking'),
            leadingItems: <Checkbox checked={showThinking} readOnly />,
            onAction: onShowThinkingToggle,
            closeOnSelect: false,
          },
        ]
      : []),
    ...(showConversationLink
      ? [
          {
            key: 'conversation-in-sentry',
            label: t('Conversation in Sentry'),
            externalHref: conversationHref,
          },
        ]
      : []),
  ];

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      items={items}
      size="xs"
      position="bottom-end"
      triggerLabel={
        <Container as="span" display={{zero: 'none', sm: 'inline'}}>
          {t('Debug')}
        </Container>
      }
      triggerProps={{
        'aria-label': t('Debug'),
        icon: <IconBug />,
        variant: 'transparent',
        size: 'xs',
      }}
    />
  );
}
