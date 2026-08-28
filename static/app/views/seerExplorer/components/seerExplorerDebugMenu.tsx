import {Checkbox} from '@sentry/scraps/checkbox';
import {Container} from '@sentry/scraps/layout';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconBug} from 'sentry/icons';
import {t} from 'sentry/locale';
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
 * (Context Engine override, Force bash mode, Show thinking) plus a link to the
 * conversation in Sentry when a run is active. The menu itself is not
 * employee-gated — each toggle is behind its own org feature flag (rolled out
 * to employees). The conversation link rides on that same surface so it only
 * appears when Debug is already visible. Flag checks live here so the parent
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
  const showContextEngineToggle = !!organization?.features.includes(
    'seer-explorer-context-engine-fe-override-ui-flag'
  );
  const showThinkingToggle = !!organization?.features.includes(
    'seer-explorer-thinking-blocks'
  );
  const showBashModeToggle = !!organization?.features.includes(
    'seer-explorer-allow-bash-mode'
  );
  // No separate employee check: Debug is already only shown via internal flags.
  // Require at least one toggle so we never surface Debug for customers solely
  // because a run URL exists.
  const hasDebugToggles =
    showContextEngineToggle || showThinkingToggle || showBashModeToggle;
  const showConversationLink = hasDebugToggles && !!conversationsUrl;

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
            externalHref: conversationsUrl,
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
