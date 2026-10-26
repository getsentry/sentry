import {IconBug} from '@sentry/icons/bug';
import {IconOpen} from '@sentry/icons/open';

import {
  CompactSelect,
  type SelectOption,
  type SelectSection,
} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';

type DebugOption = 'force-bash-mode' | 'show-thinking' | 'agent-trace';

interface SeerExplorerDebugMenuProps {
  onOverrideBashModeToggle: () => void;
  onShowThinkingToggle: () => void;
  overrideBashModeEnabled: boolean;
  showThinking: boolean;
  conversationsUrl?: string;
}

export function SeerExplorerDebugMenu({
  overrideBashModeEnabled,
  onOverrideBashModeToggle,
  showThinking,
  onShowThinkingToggle,
  conversationsUrl,
}: SeerExplorerDebugMenuProps) {
  const organization = useOrganization({allowNull: true});
  const isSentryEmployee = useIsSentryEmployee();
  // Code mode always shows thinking with no opt-out, so keep the toggle off the
  // menu whenever that flag is on. The dedicated thinking-blocks flag still owns
  // the manual toggle for non-code-mode orgs.
  const showThinkingToggle =
    !!organization?.features.includes('seer-explorer-thinking-blocks') &&
    !organization?.features.includes('seer-explorer-code-mode-tools');
  const showBashModeToggle = !!organization?.features.includes(
    'seer-explorer-allow-bash-mode'
  );

  const toggleOptions: Array<SelectOption<DebugOption>> = [
    ...(showBashModeToggle
      ? [{value: 'force-bash-mode' as const, label: t('Force bash mode on')}]
      : []),
    ...(showThinkingToggle
      ? [{value: 'show-thinking' as const, label: t('Show thinking')}]
      : []),
  ];
  const sections: Array<SelectSection<DebugOption>> = [
    ...(toggleOptions.length ? [{key: 'toggles', options: toggleOptions}] : []),
    ...(conversationsUrl
      ? [
          {
            key: 'links',
            options: [
              {
                value: 'agent-trace' as const,
                label: t('Open agent trace'),
                leadingItems: <IconOpen />,
                // This is an action, not a toggle, so it never holds selection.
                hideCheck: true,
              },
            ],
          },
        ]
      : []),
  ];
  const value: DebugOption[] = [
    ...(showBashModeToggle && overrideBashModeEnabled
      ? (['force-bash-mode'] as const)
      : []),
    ...(showThinkingToggle && showThinking ? (['show-thinking'] as const) : []),
  ];

  if (!isSentryEmployee || sections.length === 0) {
    return null;
  }

  return (
    <CompactSelect
      multiple
      options={sections}
      value={value}
      onChange={selectedOptions => {
        const selectedValues = new Set(selectedOptions.map(option => option.value));
        if (selectedValues.has('agent-trace')) {
          window.open(conversationsUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        if (
          showBashModeToggle &&
          selectedValues.has('force-bash-mode') !== overrideBashModeEnabled
        ) {
          onOverrideBashModeToggle();
        }
        if (showThinkingToggle && selectedValues.has('show-thinking') !== showThinking) {
          onShowThinkingToggle();
        }
      }}
      // Toggles keep the menu open; opening the trace closes it.
      closeOnSelect={selectedOptions =>
        selectedOptions.some(option => option.value === 'agent-trace')
      }
      position="bottom-end"
      preventOverflowOptions={{boundary: document.body}}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          aria-label={t('Debug')}
          icon={<IconBug />}
          variant="transparent"
          size="xs"
        >
          <Container as="span" display={{zero: 'none', sm: 'inline'}}>
            {t('Debug')}
          </Container>
        </OverlayTrigger.Button>
      )}
    />
  );
}
