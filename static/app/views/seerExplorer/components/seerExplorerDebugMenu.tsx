import {Checkbox} from '@sentry/scraps/checkbox';
import {Container} from '@sentry/scraps/layout';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconBug} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerExplorerDebugMenuProps {
  onOverrideCtxEngEnableToggle: () => void;
  onShowThinkingToggle: () => void;
  overrideCtxEngEnable: boolean;
  showThinking: boolean;
}

/**
 * Consolidated "Debug" dropdown holding the feature-flagged developer toggles
 * (Context Engine override, Show thinking). The flag checks live here so the
 * parent doesn't thread them through — if no flags are enabled the whole menu
 * renders nothing. The toggle state stays lifted (it's consumed elsewhere), so
 * we only receive the current values and their toggle handlers.
 */
export function SeerExplorerDebugMenu({
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  showThinking,
  onShowThinkingToggle,
}: SeerExplorerDebugMenuProps) {
  const organization = useOrganization({allowNull: true});
  const showContextEngineToggle = !!organization?.features.includes(
    'seer-explorer-context-engine-fe-override-ui-flag'
  );
  const showThinkingToggle = !!organization?.features.includes(
    'seer-explorer-thinking-blocks'
  );

  const items: MenuItemProps[] = [
    ...(showContextEngineToggle
      ? [
          {
            key: 'context-engine',
            label: t('Context Engine'),
            leadingItems: <Checkbox size="sm" checked={overrideCtxEngEnable} readOnly />,
            onAction: onOverrideCtxEngEnableToggle,
            closeOnSelect: false,
          },
        ]
      : []),
    ...(showThinkingToggle
      ? [
          {
            key: 'show-thinking',
            label: t('Show thinking'),
            leadingItems: <Checkbox size="sm" checked={showThinking} readOnly />,
            onAction: onShowThinkingToggle,
            closeOnSelect: false,
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
        <Container as="span" display={{'2xs': 'none', xs: 'inline'}}>
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
